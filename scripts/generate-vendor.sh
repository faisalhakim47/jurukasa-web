#!/usr/bin/env bash

set -eux

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

SQLITE_SOURCE=https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.51.2-build6
SQLITE_TARGET=$WORKING_DIR/web/thirdparties/npm/@sqlite.org/sqlite-wasm@3.51.2-build6
rm -rf $SQLITE_TARGET
mkdir -p $SQLITE_TARGET

wget $SQLITE_SOURCE/dist/index.mjs                    --output-document $SQLITE_TARGET/dist/index.mjs
wget $SQLITE_SOURCE/dist/sqlite3-opfs-async-proxy.js  --output-document $SQLITE_TARGET/dist/sqlite3-opfs-async-proxy.js
wget $SQLITE_SOURCE/dist/sqlite3-worker1.mjs          --output-document $SQLITE_TARGET/dist/sqlite3-worker1.mjs
wget $SQLITE_SOURCE/dist/sqlite3.wasm                 --output-document $SQLITE_TARGET/dist/sqlite3.wasm
