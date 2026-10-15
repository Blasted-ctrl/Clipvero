from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Credentials(Schema):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode()) > 512:
            raise ValueError("Password is too long.")
        return value


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name is required.")
        return value.strip()


class Identity(Schema):
    user_id: UUID
    workspace_id: UUID
    email: str
    name: str
    workspace_name: str
    role: Literal["owner", "admin", "editor", "viewer"]
    credits: int


class WorkspaceView(Schema):
    id: UUID
    name: str
    role: Literal["owner", "admin", "editor", "viewer"]


class WorkspaceList(Schema):
    items: list[WorkspaceView]


class NameUpdate(Schema):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def trim(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name is required.")
        return value.strip()


class Message(Schema):
    ok: Literal[True] = True


class ErrorDetail(Schema):
    code: str
    message: str


class ErrorResponse(Schema):
    error: ErrorDetail
    request_id: str
