#!/bin/sh
set -e

echo "Waiting for MinIO service to become ready..."
until /usr/bin/mc alias set myminio http://${MINIO_HOST:-minio}:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin_dev_secret}; do
    echo "...MinIO still warming up, retrying in 2 seconds"
    sleep 2
done

echo "Ensuring private bucket '${STORAGE_BUCKET_NAME:-tef-private}' exists..."
/usr/bin/mc mb --ignore-existing myminio/${STORAGE_BUCKET_NAME:-tef-private}

echo "Enforcing private access policy on '${STORAGE_BUCKET_NAME:-tef-private}'..."
/usr/bin/mc anonymous set none myminio/${STORAGE_BUCKET_NAME:-tef-private}

echo "MinIO development buckets successfully initialized."
