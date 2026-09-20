"""Automated PostgreSQL Logical Backup Script.

Features:
- Custom binary format (pg_dump -F c) with compression
- SHA-256 checksum generation for integrity verification
- Configurable retention rotation (prunes backups older than RETENTION_DAYS)
- Exit codes for automated cron monitoring and incident alerting
"""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def calculate_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of a file in chunks."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_backup(
    output_dir: Path,
    container_name: str = "tef-postgres",
    db_name: str = "tef_platform",
    db_user: str = "tef_admin",
    retention_days: int = 14,
) -> Path:
    """Execute logical database dump, write SHA-256 checksum, and enforce retention."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    dump_filename = f"tef_backup_{db_name}_{timestamp}.dump"
    dump_path = output_dir / dump_filename
    checksum_path = output_dir / f"{dump_filename}.sha256"

    print(f"[*] Starting PostgreSQL backup for '{db_name}'...")
    container_tmp_dump = f"/tmp/{dump_filename}"

    # Try docker exec first
    docker_check = subprocess.run(["docker", "ps", "--filter", f"name={container_name}", "-q"], capture_output=True, text=True)
    if docker_check.returncode == 0 and docker_check.stdout.strip():
        print(f"[*] Using Docker container '{container_name}' for pg_dump...")
        cmd = [
            "docker", "exec", container_name,
            "pg_dump", "-U", db_user, "-d", db_name,
            "-F", "c", "-f", container_tmp_dump
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[-] pg_dump failed: {res.stderr}", file=sys.stderr)
            sys.exit(1)

        # Copy out from container
        cp_cmd = ["docker", "cp", f"{container_name}:{container_tmp_dump}", str(dump_path)]
        cp_res = subprocess.run(cp_cmd, capture_output=True, text=True)
        if cp_res.returncode != 0:
            print(f"[-] docker cp failed: {cp_res.stderr}", file=sys.stderr)
            sys.exit(1)

        # Cleanup container tmp
        subprocess.run(["docker", "exec", container_name, "rm", "-f", container_tmp_dump], capture_output=True)
    else:
        # Fallback to local pg_dump
        print("[*] Docker container not found, attempting local pg_dump...")
        cmd = [
            "pg_dump", "-U", db_user, "-d", db_name,
            "-F", "c", "-f", str(dump_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[-] Local pg_dump failed: {res.stderr}", file=sys.stderr)
            sys.exit(1)

    # Verify file exists and is not empty
    if not dump_path.exists() or dump_path.stat().st_size == 0:
        print(f"[-] Backup file {dump_path} is empty or missing!", file=sys.stderr)
        sys.exit(1)

    file_size_mb = round(dump_path.stat().st_size / (1024 * 1024), 2)
    checksum = calculate_sha256(dump_path)
    checksum_path.write_text(f"{checksum}  {dump_filename}\n", encoding="utf-8")

    print(f"[+] Backup successfully generated: {dump_path} ({file_size_mb} MB)")
    print(f"[+] SHA-256 Checksum: {checksum}")

    # Enforce retention
    now_ts = time.time()
    cutoff_ts = now_ts - (retention_days * 86400)
    for old_file in output_dir.glob("tef_backup_*.dump*"):
        if old_file.stat().st_mtime < cutoff_ts:
            print(f"[*] Pruning expired backup file: {old_file.name}")
            old_file.unlink()

    return dump_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PostgreSQL Automated Backup Script")
    parser.add_argument("--output-dir", type=Path, default=Path("backups/postgres"), help="Backup directory")
    parser.add_argument("--container", type=str, default=os.getenv("POSTGRES_CONTAINER", "tef-postgres"))
    parser.add_argument("--db", type=str, default=os.getenv("POSTGRES_DB", "tef_platform"))
    parser.add_argument("--user", type=str, default=os.getenv("POSTGRES_ADMIN_USER", "tef_admin"))
    parser.add_argument("--retention-days", type=int, default=14)

    args = parser.parse_args()
    run_backup(
        output_dir=args.output_dir,
        container_name=args.container,
        db_name=args.db,
        db_user=args.user,
        retention_days=args.retention_days,
    )
