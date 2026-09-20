"""MinIO object storage integration for student writing submissions."""

import io
import json
import uuid
from typing import Any

import structlog

from app.core.exceptions import AppException
from app.core.storage import StorageService

logger = structlog.get_logger("tef-api.writing.storage")

# Hard upper limit on essay submission payloads (250 KB ~= 50,000 words, far exceeding TEF requirements)
MAX_SUBMISSION_BYTES = 250 * 1024


class WritingStorage:
    """Manages secure object persistence for writing submissions in MinIO."""

    @staticmethod
    def save_submission_payload(
        storage: StorageService,
        student_id: uuid.UUID,
        submission_id: uuid.UUID,
        payload: dict[str, Any],
    ) -> str:
        """Store submission JSON payload in MinIO with server-generated key:
        writing-submissions/{student_uuid}/{submission_uuid}.json
        """
        payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if len(payload_bytes) > MAX_SUBMISSION_BYTES:
            raise AppException(
                message=f"Submission exceeds maximum size limit of {MAX_SUBMISSION_BYTES // 1024} KB",
                code="SUBMISSION_TOO_LARGE",
                status_code=413,
            )

        bio = io.BytesIO(payload_bytes)
        object_key = storage.upload_file(
            file_obj=bio,
            content_type="application/json; charset=utf-8",
            folder=f"writing-submissions/{student_id}",
            file_extension="json",
            filename=str(submission_id),
        )

        logger.info(
            "writing_submission_stored",
            object_key=object_key,
            student_id=str(student_id),
            submission_id=str(submission_id),
            size_bytes=len(payload_bytes),
        )
        return object_key

    @staticmethod
    def save_submission_text(storage: StorageService, text: str) -> str:
        """Store raw submission text in MinIO with a server-generated key and strict size boundary."""
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
        return object_key

    @staticmethod
    def get_submission_data(storage: StorageService, object_key: str) -> dict[str, Any] | str:
        """Download and parse stored submission from MinIO (handles JSON or legacy plain text)."""
        if not object_key or ".." in object_key or object_key.startswith("/") or "\\" in object_key:
            raise AppException(
                message="Invalid storage object key",
                code="INVALID_STORAGE_KEY",
                status_code=400,
            )

        data = storage.download_file(object_key)
        decoded = data.decode("utf-8")
        if object_key.endswith(".json"):
            try:
                return json.loads(decoded)
            except Exception:
                return {"content": decoded}
        return decoded

    @staticmethod
    def get_submission_text(storage: StorageService, object_key: str) -> str:
        """Download and extract raw submission text content."""
        data = WritingStorage.get_submission_data(storage, object_key)
        if isinstance(data, dict):
            return data.get("content", "")
        return data
