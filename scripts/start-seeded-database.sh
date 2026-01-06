#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

IN_MEMORY_DB_FILE=$(mktemp /tmp/storeman-db-XXXXXX.db)

trap "rm -f $IN_MEMORY_DB_FILE" EXIT

sqlite3 $IN_MEMORY_DB_FILE < $WORKING_DIR/web/schemas/001-accounting.sql
sqlite3 $IN_MEMORY_DB_FILE < $WORKING_DIR/web/schemas/002-pos.sql
sqlite3 $IN_MEMORY_DB_FILE < $WORKING_DIR/web/schemas/003-chart-of-accounts.sql
sqlite3 $IN_MEMORY_DB_FILE < $WORKING_DIR/web/schemas/004-revenue-tracking.sql
sqlite3 $IN_MEMORY_DB_FILE < $WORKING_DIR/test/fixtures/simulation.sql

turso dev --db-file $IN_MEMORY_DB_FILE
