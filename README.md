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


```
docker-compose exec jupyter-user bash -c "cd /mnt && jlpm watch"
```


## Requirements

* JupyterLab >= 2.0

## Install

```bash
jupyter labextension install edc-jlab
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to edc-jlab directory
# Install dependencies
jlpm
# Build Typescript source
jlpm build
# Link your development version of the extension with JupyterLab
jupyter labextension link .
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

### Uninstall

```bash
jupyter labextension uninstall edc-jlab
```

