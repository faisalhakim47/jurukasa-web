#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

npx rolldown $WORKING_DIR/web/vendor/bundle01.ts --file $WORKING_DIR/web/vendor/bundle01.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/bundle02.ts --file $WORKING_DIR/web/vendor/bundle02.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/libsql-client-web.ts --file $WORKING_DIR/web/vendor/libsql-client-web.js --format esm --platform browser --keep-names --sourcemap

SQLITE_VENDOR_DIR=$WORKING_DIR/web/vendor/@sqlite.org/sqlite-wasm
SQLITE_SOURCE_URL=https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.51.1-build2
rm -rf $SQLITE_VENDOR_DIR
mkdir -p $SQLITE_VENDOR_DIR
files=(
"sqlite-wasm/jswasm/sqlite3-opfs-async-proxy.js"
"sqlite-wasm/jswasm/sqlite3-worker1-bundler-friendly.mjs"
"sqlite-wasm/jswasm/sqlite3-worker1-promiser-bundler-friendly.mjs"
"sqlite-wasm/jswasm/sqlite3-worker1.mjs"
"sqlite-wasm/jswasm/sqlite3.mjs"
)
for file in "${files[@]}"
do
  wget -O $SQLITE_VENDOR_DIR/$file $SQLITE_SOURCE_URL/$file
  sed -i '1i// @ts-nocheck' $SQLITE_VENDOR_DIR/$file
done
wget -O $SQLITE_VENDOR_DIR/sqlite-wasm/jswasm/sqlite3.wasm $SQLITE_SOURCE_URL/sqlite-wasm/jswasm/sqlite3.wasm
cp $SQLITE_VENDOR_DIR/sqlite-wasm/jswasm/sqlite3.mjs $SQLITE_VENDOR_DIR/sqlite-wasm/jswasm/sqlite3-bundler-friendly.mjs

SOURCESANS_VENDOR_DIR=$WORKING_DIR/web/vendor/@fontsource-variable/source-sans-3
SOURCESANS_SOURCE_URL=https://cdn.jsdelivr.net/npm/@fontsource-variable/source-sans-3@5.2.9
rm -rf $SOURCESANS_VENDOR_DIR
mkdir -p $SOURCESANS_VENDOR_DIR
files=(
"files/source-sans-3-latin-ext-wght-italic.woff2"
"files/source-sans-3-latin-ext-wght-normal.woff2"
"files/source-sans-3-latin-wght-italic.woff2"
"files/source-sans-3-latin-wght-normal.woff2"
)
for file in "${files[@]}"
do
  wget -O $SOURCESANS_VENDOR_DIR/$file $SOURCESANS_SOURCE_URL/$file
done
