#!/usr/bin/env bash

set -eux -o pipefail

if [ "${1:-}" != "--only-backend" ]; then
    npm run build:prod
fi

pip install build
python -m build

