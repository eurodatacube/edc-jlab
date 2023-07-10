#!/usr/bin/env bash

set -eux -o pipefail

cd /mnt
conda run -n default python3 -m pip uninstall -y  edc_jlab
conda run -n default python3 -m pip install -e .
jupyter labextension develop . --overwrite
jupyter server extension enable edc_jlab
jlpm run build &
