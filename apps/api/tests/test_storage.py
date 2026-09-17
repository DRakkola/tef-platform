"""Tests proving StorageService interface and operations."""

import io

from tests.conftest import MockStorageService


def test_storage_service_operations():
    """Verify storage abstraction upload, download, presigned url and delete."""
    storage = MockStorageService()
    test_data = b"sample tef exam audio data"
    file_obj = io.BytesIO(test_data)

    # 1. Upload
    key = storage.upload_file(
        file_obj=file_obj,
        content_type="audio/webm",
        folder="speaking",
        file_extension=".webm",
    )
    assert key.startswith("speaking/")
    assert key.endswith(".webm")

    # 2. Download
    downloaded = storage.download_file(key)
    assert downloaded == test_data

    # 3. Presigned URL
    url = storage.generate_presigned_url(key)
    assert key in url
    assert "http" in url

    # 4. Health
    assert storage.check_health() is True
    storage.is_healthy = False
    assert storage.check_health() is False

    # 5. Delete
    assert storage.delete_file(key) is True
    assert storage.delete_file(key) is False
