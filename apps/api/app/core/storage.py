"""S3 / MinIO storage abstraction and service implementation."""

import io
import uuid
from abc import ABC, abstractmethod
from typing import BinaryIO

import boto3
import structlog
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = structlog.get_logger("tef-api.storage")


class StorageService(ABC):
    """Abstract interface for object storage operations."""

    @abstractmethod
    def upload_file(
        self,
        file_obj: BinaryIO,
        content_type: str,
        folder: str = "general",
        file_extension: str = "",
    ) -> str:
        """Uploads a file with a server-generated key. Returns the object key."""

    @abstractmethod
    def download_file(self, object_key: str) -> bytes:
        """Downloads the binary content of an object."""

    @abstractmethod
    def generate_presigned_url(
        self,
        object_key: str,
        expiration_seconds: int = 3600,
    ) -> str:
        """Generates a temporary presigned URL for secure, authorized access."""

    @abstractmethod
    def delete_file(self, object_key: str) -> bool:
        """Deletes an object by key."""

    @abstractmethod
    def check_health(self) -> bool:
        """Verifies storage service reachability and bucket presence."""


class S3StorageService(StorageService):
    """S3-compatible storage implementation (MinIO in local/dev)."""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        use_ssl: bool = False,
        region: str = "us-east-1",
    ) -> None:
        self.bucket_name = bucket_name
        protocol = "https" if use_ssl else "http"
        endpoint = (
            f"{protocol}://{endpoint_url}" if not endpoint_url.startswith("http") else endpoint_url
        )

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
            region_name=region,
        )

    def upload_file(
        self,
        file_obj: BinaryIO,
        content_type: str,
        folder: str = "general",
        file_extension: str = "",
    ) -> str:
        # Generate a clean, randomized server-side object key
        clean_ext = file_extension.lstrip(".")
        ext_suffix = f".{clean_ext}" if clean_ext else ""
        object_key = f"{folder}/{uuid.uuid4()}{ext_suffix}"

        self.s3_client.upload_fileobj(
            file_obj,
            self.bucket_name,
            object_key,
            ExtraArgs={
                "ContentType": content_type,
                # Private by default - never expose public ACL
                "ACL": "private",
            },
        )
        logger.info("file_uploaded", object_key=object_key, bucket=self.bucket_name)
        return object_key

    def download_file(self, object_key: str) -> bytes:
        buffer = io.BytesIO()
        self.s3_client.download_fileobj(self.bucket_name, object_key, buffer)
        buffer.seek(0)
        return buffer.read()

    def generate_presigned_url(
        self,
        object_key: str,
        expiration_seconds: int = 3600,
    ) -> str:
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": object_key},
            ExpiresIn=expiration_seconds,
        )

    def delete_file(self, object_key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_key)
            logger.info("file_deleted", object_key=object_key)
            return True
        except ClientError as exc:
            logger.error("file_deletion_failed", object_key=object_key, error=str(exc))
            return False

    def check_health(self) -> bool:
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("storage_health_check_failed", error=str(exc))
            return False


# Global default storage service instance
storage_service: StorageService = S3StorageService(
    endpoint_url=settings.STORAGE_ENDPOINT,
    access_key=settings.STORAGE_ACCESS_KEY,
    secret_key=settings.STORAGE_SECRET_KEY,
    bucket_name=settings.STORAGE_BUCKET_NAME,
    use_ssl=settings.STORAGE_USE_SSL,
    region=settings.STORAGE_REGION,
)


def get_storage() -> StorageService:
    """Dependency provider for storage service."""
    return storage_service


def check_storage_health() -> bool:
    return storage_service.check_health()
