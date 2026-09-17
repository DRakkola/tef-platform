#!/bin/bash
set -e

# Create dedicated application role and ensure database ownership
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER ${POSTGRES_APP_USER:-tef_app} WITH ENCRYPTED PASSWORD '${POSTGRES_APP_PASSWORD:-tef_app_password}';
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB:-tef_platform} TO ${POSTGRES_APP_USER:-tef_app};
    ALTER DATABASE ${POSTGRES_DB:-tef_platform} OWNER TO ${POSTGRES_APP_USER:-tef_app};
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL
