#!/usr/bin/env bash

set -eux -o pipefail

cd /mnt
pip install -e .
jupyter labextension develop . --overwrite
jupyter server extension enable edc_jlab
jlpm run build &
