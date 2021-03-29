# edc-jlab

![Github Actions Status](https://github.com/eurodatacube/edc-jlab.git/workflows/Build/badge.svg)

Jupyterlab extension for Euro Data Cube

## Development

edc-jlab integrates an instance of nbviewer, so for effective development, you need to somehow reference one.
This repo includes an nginx config which sets up an nginx which reverse proxies `jupyter.myeox.at` to the local jupyter-user and `nbviewer.myeox.at` to the nbviewer.
You'll need to configure your `/etc/hosts` to point to localhost:

```
127.0.0.1  jupyter.myeox.at nbviewer.myeox.at
```

So then to get started, you just need to `docker-compose up` and run nbviewer at `localhost:8080`. For live-reload, you can run this:


OUTDATED SINCE JUPYTERLAB 3
```
docker-compose exec jupyter-user bash -c "cd /mnt && jlpm watch"
# and in another shell
docker-compose exec jupyter-user bash -c "cd /mnt && jupyter lab --watch"
```


## Requirements

* JupyterLab >= 3.0

## Install

OUTDATED SINCE JUPYTERLAB 3

## Development

To develop the extension (there might be a way with fewer steps too):
```
cd /mnt
conda deactivate
python3 -m pip uninstall --yes edc-jlab
jlpm  # install packages
jlpm build  # compile
jupyter labextension develop . --overwrite  # Install the current directory as an extension
```

After this, you can rebuild with:
```
jlpm  build
```
