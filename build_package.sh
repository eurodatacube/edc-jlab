#!/usr/bin/env bash

set -eux -o pipefail

npm run build:prod
pip install build
python -m build

