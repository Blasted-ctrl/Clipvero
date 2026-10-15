from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from clipvero_api.schemas import Schema


class Caption(Schema):
    id: UUID
    from_frame: int = Field(alias="from", ge=0)
    to_frame: int = Field(alias="to", gt=0)
    text: str = Field(max_length=500)


class Scene(Schema):
    id: UUID
    script: str = Field(max_length=1600)
    caption: str = Field(max_length=1600)
    duration_frames: int = Field(ge=15, le=5400)
    background: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    asset_id: UUID | None
    narration_id: UUID | None
    source_volume: float = Field(default=0, ge=0, le=1)
    captions: list[Caption] = Field(default_factory=list, max_length=200)
    media_start: float = Field(ge=0, le=14400)
    transition: Literal["cut", "fade"]
    fit: Literal["cover", "contain"]

    @model_validator(mode="after")
    def caption_bounds(self) -> "Scene":
        if any(not cue.from_frame < cue.to_frame <= self.duration_frames for cue in self.captions):
            raise ValueError("Caption timestamps must fit their scene.")
        return self


class Timeline(Schema):
    schema_version: Literal[1]
    fps: Literal[30]
    aspect: Literal["9:16", "1:1", "16:9"]
    font_size: int = Field(ge=24, le=100)
    caption_color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    accent_color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    caption_position: Literal["center", "bottom"]
    music_asset_id: UUID | None
    music_volume: float = Field(ge=0, le=1)
    scenes: list[Scene] = Field(min_length=1, max_length=60)

    @model_validator(mode="after")
    def valid_structure(self) -> "Timeline":
        if sum(scene.duration_frames for scene in self.scenes) > 5400:
            raise ValueError("Videos may be at most 180 seconds.")
        ids = [
            value for scene in self.scenes for value in [scene.id, *[c.id for c in scene.captions]]
        ]
        if len(ids) != len(set(ids)):
            raise ValueError("Timeline object IDs must be unique.")
        return self

    def media_ids(self) -> set[UUID]:
        return {
            value
            for scene in self.scenes
            for value in [scene.asset_id, scene.narration_id]
            if value is not None
        } | ({self.music_asset_id} if self.music_asset_id else set())
