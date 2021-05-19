from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import requests
import json
from pathlib import Path
import os


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

        notebook_download_url = f"{CATALOG_URL}/{notebook_path}?download"
        response = requests.get(notebook_download_url)
        response.raise_for_status()
        nb_bytes = response.content

        target_path: Path = Path("/home/jovyan") / target_path
        if target_path.exists():
            self.set_status(409)
            self.log.info("Target file already exists")
            self.finish(json.dumps({"message":"Target file already exists"}))
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


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]

    endpoints = [
        ("install_notebook", InstallNotebookHandler),
        ("catalog", CatalogHandler),
    ]
    handlers = [
        (url_path_join(base_url, "edc_jlab", endpoint), handler)
        for endpoint, handler in endpoints
    ]
    web_app.add_handlers(host_pattern, handlers)
