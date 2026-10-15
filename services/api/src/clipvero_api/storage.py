from typing import TYPE_CHECKING
from uuid import UUID

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

from clipvero_api.config import Settings, settings
from clipvero_api.schemas import Message
from clipvero_api.security import APIError, Me, mutation_origin, rate_limit

MIMES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
}


class ObjectStorage:
    def __init__(self, config: Settings) -> None:
        if not all(
            [
                config.s3_endpoint_url,
                config.s3_bucket,
                config.s3_access_key_id.get_secret_value(),
                config.s3_secret_access_key.get_secret_value(),
            ]
        ):
            raise APIError(503, "STORAGE_NOT_CONFIGURED", "Private storage is not connected yet.")
        self.bucket = config.s3_bucket
        self.client: S3Client = boto3.client(
            "s3",
            endpoint_url=config.s3_endpoint_url,
            region_name=config.s3_region,
            aws_access_key_id=config.s3_access_key_id.get_secret_value(),
            aws_secret_access_key=config.s3_secret_access_key.get_secret_value(),
            config=Config(
                signature_version="s3v4",
                connect_timeout=3,
                read_timeout=5,
                retries={"total_max_attempts": 1},
                s3={"addressing_style": "path"},
            ),
        )

    def check_connection(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except (BotoCoreError, ClientError) as exc:
            raise APIError(
                503,
                "STORAGE_UNAVAILABLE",
                "Private storage could not be reached. Check its configuration.",
            ) from exc

    def upload_url(self, workspace_id: UUID, asset_id: UUID, mime: str, size: int) -> str:
        if mime not in MIMES or not 1 <= size <= 100 * 1024 * 1024:
            raise APIError(422, "INVALID_UPLOAD", "Use a supported file under 100 MB.")
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": f"quarantine/{workspace_id}/{asset_id}",
                "ContentType": mime,
                "ContentLength": size,
            },
            ExpiresIn=300,
            HttpMethod="PUT",
        )

    def download_url(self, workspace_id: UUID, asset_id: UUID) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": f"media/{workspace_id}/{asset_id}"},
            ExpiresIn=300,
            HttpMethod="GET",
        )


router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


@router.post("/storage/check", dependencies=[Depends(mutation_origin)])
def check_storage(me: Me) -> Message:
    if me.member.role not in {"owner", "admin"}:
        raise APIError(403, "FORBIDDEN", "Only owners and admins can check storage configuration.")
    rate_limit(f"storage-check:{me.member.workspace_id}", 30)
    ObjectStorage(settings()).check_connection()
    return Message()
