from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import requests
import json
from pathlib import Path, PurePath
import os
import urllib.parse
import shutil
from textwrap import dedent
import typing


CATALOG_NAME = os.environ["CATALOG_NAME"]
CATALOG_URL = os.environ["CATALOG_URL"]


class InstallNotebookHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def post(self):
        body = self.get_json_body()
        notebook_path = body["nbPath"]
        target_path = body["targetPath"]

        self.log.info(f"Deploying {notebook_path} to {target_path}")

        # NOTE: `notebook_path` is usually an absolute path /notebook/foo/bar.ipynb
        #       `CATALOG_URL` usually is nbviewer.a.com/notebooks
        #       the target is supposed to be nbviewer.a.com/notebooks/foo/bar.ipynb
        #       see also the comment in index.ts:getNotebookUrlFromIFrameEvent
        nb_download_url = urllib.parse.urljoin(CATALOG_URL, f"{notebook_path}?download")
        response = requests.get(nb_download_url)
        response.raise_for_status()
        nb_bytes = response.content

        target_path: Path = Path.home() / target_path
        if target_path.exists():
            self.set_status(409)
            self.log.info("Target file already exists")
            self.finish(json.dumps({"message": "Target file already exists"}))
        else:

            target_path.write_bytes(nb_bytes)

            self.finish()


class CatalogHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        # NOTE: the catalog depends on the user profile, which is stored in an env var
        # as by our kubespawner config
        self.finish(
            {
                "name": CATALOG_NAME,
                "url": CATALOG_URL,
            }
        )


class ContestSubmitHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        relative_dir_path = self.get_json_body()["directory"]

        self.log.info(f"Contest submission {relative_dir_path}")
        shutil.copytree(
            Path.home() / relative_dir_path,
            # files will be picked up here, error on resubmit if not moved intentional!
            "/mnt/contest-submit/submission",
        )
        # Notifications are handled by s3 change handlers

        self.finish()


class StacItemHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        request_body = self.get_json_body()
        stac_item_relative_path = PurePath(request_body["item_path"])
        self.log.info(f"Creating download notebook for {stac_item_relative_path}")

        notebook_relative_path = stac_item_relative_path.with_name(
            f"process-{stac_item_relative_path.name}",
        ).with_suffix(".ipynb")
        notebook_absolute_path = Path.home() / notebook_relative_path

        if not notebook_absolute_path.exists():
            nb_contents = self.create_stac_download_notebook(stac_item_relative_path)

            notebook_absolute_path.write_text(
                json.dumps(nb_contents, indent=4),
            )

        self.finish({"notebook_path": str(notebook_relative_path)})

    @staticmethod
    def create_stac_download_notebook(item_path: PurePath) -> typing.Dict:
        cells = [
            f"""
            import json
            import requests
            import pystac
            from pathlib import Path
            from IPython.display import display
            import ipywidgets as widgets
            stac_data = json.load(open("{item_path}"))
            # work around missing datetime in SH openeo backend
            stac_data['properties']['datetime'] = "2020-01-01"
            item = pystac.Item.from_dict(stac_data)
            item
            """,
            """
            button_dl_user = widgets.Button(description="Download (user)", icon='user', layout=widgets.Layout(width='250px'))
            button_dl_shared = widgets.Button(description="Download (shared)", icon='share-alt', layout=widgets.Layout(width='250px'))
            output = widgets.Output()
            display(button_dl_user, button_dl_shared,  output)
            @output.capture()
            def download(button):
                target_dir = Path.home() / ("shared" if button == button_dl_shared else "")  / "downloaded_stac_files"
                output.clear_output()
                for key, asset in item.assets.items():
                    target_file = target_dir / key
                    target_file.parent.mkdir(exist_ok=True, parents=True)
                    print(f"Downloading {key} to {target_file.relative_to(Path.home())}")
                    response = requests.get(asset.href, stream=True)
                    response.raise_for_status()
                    with open(target_file, "wb") as handle:
                        for data in response.iter_content():
                            handle.write(data)

            button_dl_user.on_click(download)
            button_dl_shared.on_click(download)
            """,
        ]

        return {
            "cells": [
                {
                    "source": [
                        f"{line}\n" for line in dedent(source).split("\n") if line
                    ],
                    "cell_type": "code",
                    "metadata": {},
                    "outputs": [],
                }
                for source in cells
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3 (ipykernel)",
                    "language": "python",
                    "name": "python3",
                },
                "language_info": {
                    "codemirror_mode": {"name": "ipython", "version": 3},
                    "file_extension": ".py",
                    "mimetype": "text/x-python",
                    "name": "python",
                    "nbconvert_exporter": "python",
                    "pygments_lexer": "ipython3",
                    "version": "3.9.7",
                },
            },
            "nbformat": 4,
            "nbformat_minor": 5,
        }


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]

    endpoints = [
        ("install_notebook", InstallNotebookHandler),
        ("catalog", CatalogHandler),
        ("contest_submit", ContestSubmitHandler),
        ("stac_item", StacItemHandler),
    ]
    handlers = [
        (url_path_join(base_url, "edc_jlab", endpoint), handler)
        for endpoint, handler in endpoints
    ]
    web_app.add_handlers(host_pattern, handlers)
