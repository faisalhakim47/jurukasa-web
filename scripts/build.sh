#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

npx rolldown $WORKING_DIR/web/vendor/bundle01.ts --file $WORKING_DIR/web/vendor/bundle01.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/bundle02.ts --file $WORKING_DIR/web/vendor/bundle02.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/libsql-client-wasm.ts --file $WORKING_DIR/web/vendor/libsql-client-wasm.js --format esm --platform browser --keep-names --sourcemap
npx rolldown $WORKING_DIR/web/vendor/libsql-client-web.ts --file $WORKING_DIR/web/vendor/libsql-client-web.js --format esm --platform browser --keep-names --sourcemap
