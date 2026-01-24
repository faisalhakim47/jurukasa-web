#!/usr/bin/env bash

set -eux

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

grep -rPoh '(?<=<material-symbols name=")[^"]*' $WORKING_DIR/web | sort -u > $WORKING_DIR/web/material-symbols-list.txt
