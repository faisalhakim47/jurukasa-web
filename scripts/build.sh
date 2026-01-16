#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

npx rolldown $WORKING_DIR/web/vendor/bundle01.ts --file $WORKING_DIR/web/vendor/bundle01.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/bundle02.ts --file $WORKING_DIR/web/vendor/bundle02.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/libsql-client-web.ts --file $WORKING_DIR/web/vendor/libsql-client-web.js --format esm --platform browser --keep-names --sourcemap

SQLITE_VENDOR_DIR=$WORKING_DIR/web/vendor/sqlite
SQLITE_SOURCE_URL=https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.51.1-build2/sqlite-wasm/jswasm

rm -rf $SQLITE_VENDOR_DIR
mkdir -p $SQLITE_VENDOR_DIR

files=(
"sqlite3-opfs-async-proxy.js"
"sqlite3-worker1-bundler-friendly.mjs"
"sqlite3-worker1-promiser-bundler-friendly.mjs"
"sqlite3-worker1.mjs"
"sqlite3.mjs"
)
for file in "${files[@]}"
do
  wget -P $SQLITE_VENDOR_DIR/ $SQLITE_SOURCE_URL/$file
  sed -i '1i// @ts-nocheck' $SQLITE_VENDOR_DIR/$file
done
wget -P $SQLITE_VENDOR_DIR/ $SQLITE_SOURCE_URL/sqlite3.wasm

cp $SQLITE_VENDOR_DIR/sqlite3.mjs $SQLITE_VENDOR_DIR/sqlite3-bundler-friendly.mjs
