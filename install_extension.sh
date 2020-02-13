#!/bin/bash -ex

jlpm
jlpm build
jupyter labextension link .
jlpm build
jupyter lab build

