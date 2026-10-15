import hashlib
import json
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from clipvero_api.models import AuditLog, CreditTransaction, now
from clipvero_api.project_models import Project, ProjectVersion, SceneRecord, VideoTimeline
from clipvero_api.routes import identity
from clipvero_api.schemas import Message, Schema
from clipvero_api.security import DB, APIError, Me, mutation_origin
from clipvero_api.timeline import Timeline

router = APIRouter(prefix="/api/v1", tags=["projects"])


class ProjectCreate(Schema):
    title: str = Field(min_length=1, max_length=120, pattern=r"\S")
    timeline: Timeline
    creation_key: UUID


class ProjectUpdate(Schema):
    title: str = Field(min_length=1, max_length=120, pattern=r"\S")
    timeline: Timeline
    revision: int = Field(ge=1)


class ProjectView(Schema):
    id: UUID
    title: str
    mode: Literal["script"] = "script"
    status: Literal["draft"] = "draft"
    timeline: Timeline
    revision: int
    rendered_revision: None = None
    output_asset_id: None = None
    scheduled_at: None = None
    description: str = ""
    created_at: int
    updated_at: int


class ProjectList(Schema):
    items: list[ProjectView]
    next_offset: int | None


class VersionView(Schema):
    revision: int
    title: str
    timeline: Timeline
    created_at: int


def writable(me: Me) -> None:
    if me.member.role == "viewer":
        raise APIError(403, "FORBIDDEN", "Your workspace role allows viewing only.")


def owned_project(db: DB, me: Me, project_id: UUID, *, lock: bool = False) -> Project:
    statement = select(Project).where(
        Project.id == project_id,
        Project.workspace_id == me.member.workspace_id,
        Project.deleted_at.is_(None),
    )
    if lock:
        statement = statement.with_for_update()
    project = db.scalar(statement)
    if project is None:
        raise APIError(404, "NOT_FOUND", "Project not found.")
    return project


def milliseconds(value: datetime) -> int:
    return int(value.replace(tzinfo=value.tzinfo or UTC).timestamp() * 1000)


def view(project: Project, document: dict[str, Any]) -> ProjectView:
    return ProjectView(
        id=project.id,
        title=project.title,
        revision=project.revision,
        timeline=Timeline.model_validate(document),
        created_at=milliseconds(project.created_at),
        updated_at=milliseconds(project.updated_at),
    )


def read_project(project_id: UUID, me: Me, db: DB) -> ProjectView:
    row = db.execute(
        select(Project, VideoTimeline.data)
        .join(VideoTimeline, VideoTimeline.project_id == Project.id)
        .where(
            Project.id == project_id,
            Project.workspace_id == me.member.workspace_id,
            Project.deleted_at.is_(None),
        )
        .execution_options(populate_existing=True)
    ).one_or_none()
    if row is None:
        raise APIError(404, "NOT_FOUND", "Project not found.")
    return view(row[0], row[1])


def persist_timeline(project: Project, timeline: Timeline, me: Me, db: DB) -> None:
    if timeline.media_ids():
        raise APIError(404, "MEDIA_UNAVAILABLE", "Media is not available in this workspace.")
    document = timeline.model_dump(by_alias=True, mode="json")
    current = db.scalar(select(VideoTimeline).where(VideoTimeline.project_id == project.id))
    if current is None:
        current = VideoTimeline(project_id=project.id, data=document)
        db.add(current)
        db.flush()
    else:
        current.data = document
        db.execute(delete(SceneRecord).where(SceneRecord.timeline_id == current.id))
    db.add(
        ProjectVersion(
            project_id=project.id,
            revision=project.revision,
            title=project.title,
            data=document,
            created_by=me.user.id,
        )
    )
    db.add_all(
        [
            SceneRecord(
                timeline_id=current.id,
                object_id=scene.id,
                position=index,
                data=scene.model_dump(by_alias=True, mode="json"),
            )
            for index, scene in enumerate(timeline.scenes)
        ]
    )


@router.post("/projects", status_code=201, dependencies=[Depends(mutation_origin)])
def create_project(body: ProjectCreate, me: Me, db: DB) -> ProjectView:
    writable(me)
    if body.timeline.media_ids():
        raise APIError(404, "MEDIA_UNAVAILABLE", "Media is not available in this workspace.")
    fingerprint = hashlib.sha256(
        json.dumps(body.model_dump(mode="json", exclude={"creation_key"}), sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(
        select(Project).where(
            Project.workspace_id == me.member.workspace_id,
            Project.creation_key == body.creation_key,
        )
    )
    if existing:
        if existing.deleted_at or existing.creation_hash != fingerprint:
            raise APIError(409, "CREATION_CONFLICT", "Start a new project creation request.")
        return read_project(existing.id, me, db)
    project = Project(
        workspace_id=me.member.workspace_id,
        created_by=me.user.id,
        title=body.title.strip(),
        creation_key=body.creation_key,
        creation_hash=fingerprint,
        revision=1,
    )
    db.add(project)
    try:
        db.flush()
        persist_timeline(project, body.timeline, me, db)
        db.add(
            AuditLog(
                workspace_id=me.member.workspace_id, user_id=me.user.id, action="project.created"
            )
        )
        result = read_project(project.id, me, db)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "CREATION_CONFLICT", "This project request is already being processed."
        ) from exc
    return result


@router.get("/projects")
def list_projects(
    me: Me,
    db: DB,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ProjectList:
    projects = db.execute(
        select(Project, VideoTimeline.data)
        .join(VideoTimeline, VideoTimeline.project_id == Project.id)
        .where(Project.workspace_id == me.member.workspace_id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc(), Project.id)
        .offset(offset)
        .limit(limit + 1)
    ).all()
    return ProjectList(
        items=[view(project, document) for project, document in projects[:limit]],
        next_offset=offset + limit if len(projects) > limit else None,
    )


@router.get("/projects/{project_id}")
def get_project(project_id: UUID, me: Me, db: DB) -> ProjectView:
    return read_project(project_id, me, db)


@router.patch("/projects/{project_id}", dependencies=[Depends(mutation_origin)])
def save_project(project_id: UUID, body: ProjectUpdate, me: Me, db: DB) -> ProjectView:
    writable(me)
    project = owned_project(db, me, project_id, lock=True)
    if project.revision != body.revision:
        raise APIError(
            409, "REVISION_CONFLICT", "A newer edit exists. Preserve your edit or reload."
        )
    project.title = body.title.strip()
    project.revision += 1
    project.updated_at = now()
    persist_timeline(project, body.timeline, me, db)
    result = read_project(project.id, me, db)
    db.commit()
    return result


@router.get("/projects/{project_id}/versions")
def versions(
    project_id: UUID, me: Me, db: DB, offset: Annotated[int, Query(ge=0, le=10000)] = 0
) -> list[VersionView]:
    owned_project(db, me, project_id)
    rows = db.scalars(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .order_by(ProjectVersion.revision.desc())
        .offset(offset)
        .limit(50)
    ).all()
    return [
        VersionView(
            revision=row.revision,
            title=row.title,
            timeline=Timeline.model_validate(row.data),
            created_at=milliseconds(row.created_at),
        )
        for row in rows
    ]


@router.delete("/projects/{project_id}", dependencies=[Depends(mutation_origin)])
def delete_project(project_id: UUID, me: Me, db: DB) -> Message:
    writable(me)
    project = db.scalar(
        select(Project)
        .where(Project.id == project_id, Project.workspace_id == me.member.workspace_id)
        .with_for_update()
    )
    if project is None:
        raise APIError(404, "NOT_FOUND", "Project not found.")
    if not project.deleted_at:
        project.deleted_at = now()
        db.add(
            AuditLog(
                workspace_id=me.member.workspace_id, user_id=me.user.id, action="project.deleted"
            )
        )
        db.commit()
    return Message()


@router.get("/state", tags=["editor"])
def editor_state(me: Me, db: DB) -> dict[str, Any]:
    account = identity(me, db).model_dump(by_alias=True, mode="json")
    return {
        "me": {**account, "plan": "trial", "subscriptionStatus": "trial"},
        "projects": [
            p.model_dump(by_alias=True, mode="json") for p in list_projects(me, db, limit=100).items
        ],
        "jobs": [],
        "assets": [],
        "characters": [],
        "presets": [],
        "pipelines": [],
        "ledger": [
            {
                "operation": row.operation,
                "amount": row.amount,
                "detail": "One-time trial credits",
                "createdAt": milliseconds(row.created_at),
            }
            for row in db.scalars(
                select(CreditTransaction)
                .where(CreditTransaction.workspace_id == me.member.workspace_id)
                .order_by(CreditTransaction.created_at.desc())
                .limit(100)
            )
        ],
        "usage": [],
        "pipelineErrors": [],
        "appName": "Clipvero",
        "capabilities": {"ai": False, "worker": False, "billing": False, "publishing": False},
    }
