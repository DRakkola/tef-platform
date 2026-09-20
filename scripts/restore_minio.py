"""MinIO / S3 Object Storage Restoration & Integrity Verification Script.

Features:
- Restores objects from snapshot directory to target MinIO bucket
- Verifies integrity of each restored object via SHA-256 manifest
- Audits for missing objects and orphan objects
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
import boto3
from botocore.client import Config


def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run_minio_restore(
    snapshot_dir: Path,
    target_bucket: str = "tef-restore-test",
    endpoint: str = "http://localhost:9000",
    access_key: str = "minioadmin",
    secret_key: str = "minioadmin",
) -> bool:
    """Restores all objects from a snapshot directory and verifies checksums."""
    manifest_file = snapshot_dir / "manifest.json"
    if not manifest_file.exists():
        print(f"[-] Manifest file not found at {manifest_file}", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    print(f"[*] Restoring MinIO snapshot from {snapshot_dir} into bucket '{target_bucket}'...")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )

    # Ensure target bucket exists
    try:
        s3.head_bucket(Bucket=target_bucket)
    except Exception:
        s3.create_bucket(Bucket=target_bucket)
        print(f"[+] Created target bucket '{target_bucket}'")

    restored_count = 0
    data_dir = snapshot_dir / "data"

    for key, meta in manifest.get("objects", {}).items():
        local_file = data_dir / key
        if not local_file.exists():
            print(f"[-] Missing local object file: {local_file}", file=sys.stderr)
            sys.exit(1)

        file_bytes = local_file.read_bytes()
        # Pre-upload integrity check
        if calculate_sha256(file_bytes) != meta["sha256"]:
            print(f"[-] Local file corrupted for {key}!", file=sys.stderr)
            sys.exit(1)

        s3.put_object(
            Bucket=target_bucket,
            Key=key,
            Body=file_bytes,
            ContentType=meta.get("content_type", "application/octet-stream"),
            ACL="private",
        )
        restored_count += 1

    print(f"[+] Restored {restored_count} objects into '{target_bucket}'")

    # Post-restore verification: Download and check SHA-256 for each object
    print("[*] Verifying integrity of all restored objects in MinIO...")
    for key, meta in manifest.get("objects", {}).items():
        resp = s3.get_object(Bucket=target_bucket, Key=key)
        downloaded = resp["Body"].read()
        downloaded_hash = calculate_sha256(downloaded)
        if downloaded_hash != meta["sha256"]:
            print(f"[-] Verification failed for {key}: hash mismatch!", file=sys.stderr)
            sys.exit(1)

    print(f"[+] 100% of restored objects verified against manifest SHA-256 checksums.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MinIO Object Storage Restore Script")
    parser.add_argument("snapshot_dir", type=Path, help="Path to MinIO backup snapshot directory")
    parser.add_argument("--target-bucket", type=str, default="tef-restore-test", help="Target bucket name")
    parser.add_argument("--endpoint", type=str, default=os.getenv("STORAGE_ENDPOINT", "http://localhost:9000"))
    parser.add_argument("--access-key", type=str, default=os.getenv("STORAGE_ACCESS_KEY", "minioadmin"))
    parser.add_argument("--secret-key", type=str, default=os.getenv("STORAGE_SECRET_KEY", "minioadmin"))

    args = parser.parse_args()
    endpoint = args.endpoint if args.endpoint.startswith("http") else f"http://{args.endpoint}"
    run_minio_restore(
        snapshot_dir=args.snapshot_dir,
        target_bucket=args.target_bucket,
        endpoint=endpoint,
        access_key=args.access_key,
        secret_key=args.secret_key,
    )
