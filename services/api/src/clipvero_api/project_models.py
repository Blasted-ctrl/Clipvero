from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from clipvero_api.models import Base, Record

Document = JSON().with_variant(JSONB(), "postgresql")


class Project(Record, Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("workspace_id", "creation_key", name="uq_project_creation"),
        Index("ix_projects_workspace_updated", "workspace_id", "updated_at"),
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(120))
    revision: Mapped[int] = mapped_column(default=1)
    creation_key: Mapped[UUID]
    creation_hash: Mapped[str] = mapped_column(String(64))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VideoTimeline(Record, Base):
    __tablename__ = "video_timelines"
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    data: Mapped[dict[str, Any]] = mapped_column(Document)


class ProjectVersion(Record, Base):
    __tablename__ = "project_versions"
    __table_args__ = (UniqueConstraint("project_id", "revision", name="uq_project_revision"),)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    revision: Mapped[int]
    title: Mapped[str] = mapped_column(String(120))
    data: Mapped[dict[str, Any]] = mapped_column(Document)
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))


class SceneRecord(Record, Base):
    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("timeline_id", "position", name="uq_scene_position"),)
    timeline_id: Mapped[UUID] = mapped_column(ForeignKey("video_timelines.id", ondelete="CASCADE"))
    object_id: Mapped[UUID]
    position: Mapped[int]
    data: Mapped[dict[str, Any]] = mapped_column(Document)
