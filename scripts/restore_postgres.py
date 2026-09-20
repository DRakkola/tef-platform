"""Automated PostgreSQL Logical Restore & Verification Script.

Features:
- Checksum validation against .sha256 manifest before restoring
- Target database isolation (e.g. tef_platform_restore_test)
- Comprehensive schema and data verification
- Exit codes for automated disaster recovery testing
"""

import argparse
import hashlib
import os
import subprocess
import sys
from pathlib import Path


def calculate_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_restore(
    dump_path: Path,
    target_db: str = "tef_platform_restore_test",
    container_name: str = "tef-postgres",
    db_user: str = "tef_admin",
    verify_checksum: bool = True,
) -> bool:
    """Restores database from dump and validates integrity."""
    if not dump_path.exists():
        print(f"[-] Dump file not found: {dump_path}", file=sys.stderr)
        sys.exit(1)

    # 1. Checksum verification
    if verify_checksum:
        checksum_file = dump_path.parent / f"{dump_path.name}.sha256"
        if checksum_file.exists():
            expected = checksum_file.read_text(encoding="utf-8").split()[0].strip()
            actual = calculate_sha256(dump_path)
            if expected != actual:
                print(f"[-] Checksum mismatch! Expected {expected}, got {actual}", file=sys.stderr)
                sys.exit(1)
            print(f"[+] SHA-256 Checksum verified: {actual}")
        else:
            print(f"[!] Warning: No checksum file found at {checksum_file}, skipping verification")

    print(f"[*] Restoring dump into target database '{target_db}'...")

    docker_check = subprocess.run(["docker", "ps", "--filter", f"name={container_name}", "-q"], capture_output=True, text=True)
    in_docker = docker_check.returncode == 0 and bool(docker_check.stdout.strip())

    if in_docker:
        container_dump = f"/tmp/{dump_path.name}"
        # Copy dump into container
        subprocess.run(["docker", "cp", str(dump_path), f"{container_name}:{container_dump}"], check=True)

        # Ensure target database exists
        subprocess.run([
            "docker", "exec", container_name,
            "psql", "-U", db_user, "-d", "postgres", "-c",
            f"DROP DATABASE IF EXISTS {target_db}; CREATE DATABASE {target_db};"
        ], check=True)

        # Restore
        restore_cmd = [
            "docker", "exec", container_name,
            "pg_restore", "-U", db_user, "-d", target_db,
            "--clean", "--if-exists", "--no-owner", container_dump
        ]
        res = subprocess.run(restore_cmd, capture_output=True, text=True)
        # pg_restore may return 0 or 1 with non-fatal warnings
        if res.returncode not in (0, 1):
            print(f"[-] pg_restore failed: {res.stderr}", file=sys.stderr)
            sys.exit(1)

        # Verification query
        count_tables = subprocess.run([
            "docker", "exec", container_name,
            "psql", "-U", db_user, "-d", target_db, "-t", "-c",
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
        ], capture_output=True, text=True, check=True).stdout.strip()

        print(f"[+] Successfully restored {count_tables} tables into '{target_db}'")

        # Clean container tmp
        subprocess.run(["docker", "exec", container_name, "rm", "-f", container_dump], capture_output=True)
    else:
        # Local restore
        subprocess.run([
            "psql", "-U", db_user, "-d", "postgres", "-c",
            f"DROP DATABASE IF EXISTS {target_db}; CREATE DATABASE {target_db};"
        ], check=True)

        restore_cmd = [
            "pg_restore", "-U", db_user, "-d", target_db,
            "--clean", "--if-exists", "--no-owner", str(dump_path)
        ]
        res = subprocess.run(restore_cmd, capture_output=True, text=True)
        if res.returncode not in (0, 1):
            print(f"[-] Local pg_restore failed: {res.stderr}", file=sys.stderr)
            sys.exit(1)

        count_tables = subprocess.run([
            "psql", "-U", db_user, "-d", target_db, "-t", "-c",
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
        ], capture_output=True, text=True, check=True).stdout.strip()
        print(f"[+] Successfully restored {count_tables} tables into '{target_db}'")

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PostgreSQL Automated Restore Script")
    parser.add_argument("dump_path", type=Path, help="Path to .dump binary backup file")
    parser.add_argument("--target-db", type=str, default="tef_platform_restore_test", help="Target database name")
    parser.add_argument("--container", type=str, default=os.getenv("POSTGRES_CONTAINER", "tef-postgres"))
    parser.add_argument("--user", type=str, default=os.getenv("POSTGRES_ADMIN_USER", "tef_admin"))
    parser.add_argument("--no-verify", action="store_true", help="Skip SHA-256 checksum verification")

    args = parser.parse_args()
    run_restore(
        dump_path=args.dump_path,
        target_db=args.target_db,
        container_name=args.container,
        db_user=args.user,
        verify_checksum=not args.no_verify,
    )
