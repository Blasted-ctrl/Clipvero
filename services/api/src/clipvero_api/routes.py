from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from clipvero_api.models import (
    AuditLog,
    CreditAccount,
    CreditTransaction,
    User,
    Workspace,
    WorkspaceMember,
)
from clipvero_api.schemas import (
    Credentials,
    Identity,
    Message,
    NameUpdate,
    Registration,
    WorkspaceList,
    WorkspaceView,
)
from clipvero_api.security import (
    COOKIE,
    DB,
    APIError,
    Me,
    auth_limit,
    broker,
    create_session,
    hash_password,
    mutation_origin,
    registration_limit,
    verify_password,
)

router = APIRouter(prefix="/api/v1")
mutations = [Depends(mutation_origin)]


def identity(me: Me, db: DB) -> Identity:
    workspace = db.get(Workspace, me.member.workspace_id)
    account = db.scalar(
        select(CreditAccount).where(CreditAccount.workspace_id == me.member.workspace_id)
    )
    if workspace is None or account is None:
        raise APIError(
            503, "ACCOUNT_UNAVAILABLE", "Your workspace needs support. Please try again."
        )
    return Identity(
        user_id=me.user.id,
        workspace_id=workspace.id,
        email=me.user.email,
        name=me.user.name,
        workspace_name=workspace.name,
        role=me.member.role,
        credits=account.balance,
    )


@router.get("/health/live", tags=["health"])
def live() -> Message:
    return Message()


@router.get("/health/ready", tags=["health"])
def ready(db: DB) -> Message:
    try:
        db.execute(text("SELECT 1 FROM alembic_version"))
        with broker() as redis:
            redis.ping()
    except (SQLAlchemyError, OSError) as exc:
        raise APIError(503, "NOT_READY", "A required service is unavailable.") from exc
    return Message()


@router.post("/auth/register", status_code=201, dependencies=mutations, tags=["auth"])
def register(body: Registration, response: Response, db: DB) -> Message:
    registration_limit()
    auth_limit(str(body.email))
    user = User(email=str(body.email), name=body.name, password_hash=hash_password(body.password))
    workspace = Workspace(name=f"{body.name.split()[0]}'s studio")
    try:
        db.add_all([user, workspace])
        db.flush()
        db.add_all(
            [
                WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"),
                CreditAccount(workspace_id=workspace.id, balance=120),
                CreditTransaction(
                    workspace_id=workspace.id,
                    amount=120,
                    operation="trial",
                    idempotency_key=f"trial:{workspace.id}",
                ),
                AuditLog(workspace_id=workspace.id, user_id=user.id, action="account.created"),
            ]
        )
        create_session(db, response, user.id, workspace.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "ACCOUNT_EXISTS", "An account with that email already exists.") from exc
    return Message()


@router.post("/auth/login", dependencies=mutations, tags=["auth"])
def login(body: Credentials, response: Response, db: DB) -> Message:
    auth_limit(str(body.email))
    user = db.scalar(select(User).where(User.email == str(body.email)))
    valid = verify_password(
        body.password, user.password_hash if user else "0" * 32 + ":" + "0" * 128
    )
    if user is None or not valid:
        raise APIError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    member = db.scalar(
        select(WorkspaceMember)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(WorkspaceMember.created_at, WorkspaceMember.id)
        .limit(1)
    )
    if member is None:
        raise APIError(403, "NO_WORKSPACE", "Your account has no accessible workspace.")
    create_session(db, response, user.id, member.workspace_id)
    db.commit()
    return Message()


@router.get("/auth/me", tags=["auth"])
def me(principal: Me, db: DB) -> Identity:
    return identity(principal, db)


@router.post("/auth/logout", dependencies=mutations, tags=["auth"])
def logout(request: Request, response: Response, db: DB) -> Message:
    from clipvero_api.models import UserSession
    from clipvero_api.security import token_hash

    session = db.get(UserSession, token_hash(request.cookies.get(COOKIE, "")))
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(COOKIE, path="/")
    return Message()


@router.get("/workspaces", tags=["workspaces"])
def workspaces(me: Me, db: DB) -> WorkspaceList:
    rows = db.execute(
        select(Workspace, WorkspaceMember)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == me.user.id)
        .order_by(Workspace.created_at)
        .limit(100)
    ).all()
    return WorkspaceList(items=[WorkspaceView(id=w.id, name=w.name, role=m.role) for w, m in rows])


def membership(db: DB, user_id: UUID, workspace_id: UUID) -> WorkspaceMember:
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    if member is None:
        raise APIError(404, "NOT_FOUND", "Workspace not found.")
    return member


@router.get("/workspaces/{workspace_id}", tags=["workspaces"])
def workspace(workspace_id: UUID, me: Me, db: DB) -> WorkspaceView:
    member = membership(db, me.user.id, workspace_id)
    row = db.get(Workspace, workspace_id)
    assert row is not None
    return WorkspaceView(id=row.id, name=row.name, role=member.role)


@router.patch("/workspaces/{workspace_id}", dependencies=mutations, tags=["workspaces"])
def update_workspace(workspace_id: UUID, body: NameUpdate, me: Me, db: DB) -> WorkspaceView:
    member = membership(db, me.user.id, workspace_id)
    if member.role not in {"owner", "admin"}:
        raise APIError(403, "FORBIDDEN", "Only workspace owners and admins can rename it.")
    row = db.get(Workspace, workspace_id)
    assert row is not None
    row.name = body.name
    db.add(AuditLog(workspace_id=workspace_id, user_id=me.user.id, action="workspace.renamed"))
    db.commit()
    return WorkspaceView(id=row.id, name=row.name, role=member.role)


@router.patch("/settings/profile", dependencies=mutations, tags=["settings"])
def update_profile(body: NameUpdate, me: Me, db: DB) -> Identity:
    me.user.name = body.name
    db.add(
        AuditLog(workspace_id=me.member.workspace_id, user_id=me.user.id, action="profile.updated")
    )
    db.commit()
    return identity(me, db)
