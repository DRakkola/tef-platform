"""MinIO object storage integration for student writing submissions."""

import io

import structlog

from app.core.exceptions import AppException
from app.core.storage import StorageService

logger = structlog.get_logger("tef-api.writing.storage")

# Hard upper limit on essay submission payloads (250 KB ~= 50,000 words, far exceeding TEF requirements)
MAX_SUBMISSION_BYTES = 250 * 1024


class WritingStorage:
    """Manages secure object persistence for writing submissions in MinIO."""

    @staticmethod
    def save_submission_text(storage: StorageService, text: str) -> str:
        """Store raw submission text in MinIO with a server-generated key and strict size boundary.

        Guarantees:
        1. Never trusts client filenames (generates random UUID).
        2. Never allows path traversal.
        3. Enforces upload size limit.
        4. Stored as private object.
        """
        encoded_bytes = text.encode("utf-8")
        if len(encoded_bytes) > MAX_SUBMISSION_BYTES:
            raise AppException(
                message=f"Submission exceeds maximum size limit of {MAX_SUBMISSION_BYTES // 1024} KB",
                code="SUBMISSION_TOO_LARGE",
                status_code=413,
            )

        bio = io.BytesIO(encoded_bytes)

        object_key = storage.upload_file(
            file_obj=bio,
            content_type="text/plain; charset=utf-8",
            folder="writing_submissions",
            file_extension="txt",
        )

        logger.info(
            "writing_submission_stored",
            object_key=object_key,
            size_bytes=len(encoded_bytes),
        )
        return object_key

    @staticmethod
    def get_submission_text(storage: StorageService, object_key: str) -> str:
        """Download and decode stored submission text from MinIO."""
        # Sanitize key to prevent path traversal
        if ".." in object_key or object_key.startswith("/"):
            raise AppException(
                message="Invalid storage object key",
                code="INVALID_STORAGE_KEY",
                status_code=400,
            )

        data = storage.download_file(object_key)
        return data.decode("utf-8")
