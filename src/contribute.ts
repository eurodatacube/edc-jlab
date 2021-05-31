// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import { JupyterFrontEnd } from "@jupyterlab/application";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { IFileBrowserFactory, FileBrowser } from "@jupyterlab/filebrowser";
import { Contents } from "@jupyterlab/services";
import { toArray } from "@lumino/algorithm";
import { NOTEBOOK_ICON_CLASS } from "./constants";


export const CONTRIBUTE_STAGING_PATH = ".contribute-staging";


async function ensureStatingDirExists(
  contents: Contents.IManager
): Promise<void> {
  // We should check if the dir exists, but we the server doesn't allow accessing
  // hidden files. However we can create it and check if the response is 409 conflict.
  // Also, the API doesn't allow creating dirs, only untitled dirs which are later
  // renamed.
  console.log(`Trying to create ${CONTRIBUTE_STAGING_PATH}`);
  const dir = await contents.newUntitled({ type: "directory" });
  try {
    try {
      await contents.rename(dir.name, CONTRIBUTE_STAGING_PATH);
    } catch (error) {
      if (error.response.status == 404) {
        // this means success, lol. probably the server filters hidden dirs, so
        // it doesn't find the dir it has renamed.
        console.log("Created dir successfully");
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error.response.status == 409) {
      // CONFLICT
      await contents.delete(dir.name);
      console.log("Directory already exists");
    } else {
      throw error;
    }
  }
}
/**
 * Add a context menu entry which triggers contributions
 */
export function activateContribute(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  factory: IFileBrowserFactory) {
  const contributeCommandId = "edc:contribute";
  app.commands.addCommand(contributeCommandId, {
    label: "EDC: Contribute Notebook",
    iconClass: NOTEBOOK_ICON_CLASS,
    isVisible: () => {
      // NOTE: market place is currently restricted to 1 contributed file
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return false;
      }
      const files = toArray(filebrowser.selectedItems());
      if (files.length !== 1) {
        return false;
      }
      return files[0].type === "notebook";
    },
    execute: () => {
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return;
      }

      const items = toArray(filebrowser.selectedItems());
      console.log(
        "Contribute items:",
        items.map((item) => item.path).join(", ")
      );
      if (items.length > 0) {
        const copyPromises = items.map(async (item: Contents.IModel) => {
          // make sure to delete target first in case it's an update
          try {
            await docmanager.deleteFile(
              `${CONTRIBUTE_STAGING_PATH}/${item.name}`
            );
          } catch (error) {
            // 404 error is expected, everything else is bad
            if (error.response.status !== 404) {
              throw error;
            }
          }

          return docmanager.copy(item.path, CONTRIBUTE_STAGING_PATH);
        });

        // need to open window right now in click handler, it's not allowed
        // in promise handler.
        const newTab = window.open("", "_blank");
        Promise.all(copyPromises)
          .then(() => {
            // TODO: open according contribute page (dev/prod)
            // NOTE: market place is currently restricted to 1 contributed file
            newTab.location.href = `https://eurodatacube.com/contributions/jupyter-notebook/new/${items[0].name}`;
          })
          .catch(() => {
            newTab.close();
            alert("Failed to contribute files.");
          });
      }
    },
  });

  // selector as from packages/filebrowser-extension/src/index.ts
  const selectorNotDir = '.jp-DirListing-item[data-isdir="false"]';

  app.contextMenu.addItem({
    selector: selectorNotDir,
    command: contributeCommandId,
    rank: 9, // about at the end of file-operations
  });

  ensureStatingDirExists(docmanager.services.contents);
}
