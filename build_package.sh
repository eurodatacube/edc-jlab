#!/usr/bin/env bash
pip install jupyter_packaging
python setup.py sdist
python setup.py bdist_wheel

