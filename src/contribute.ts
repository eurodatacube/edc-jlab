// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import { JupyterFrontEnd } from "@jupyterlab/application";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { IFileBrowserFactory, FileBrowser } from "@jupyterlab/filebrowser";
import { toArray } from "@lumino/algorithm";
import { NOTEBOOK_ICON_CLASS } from "./constants";


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
        // TODO: make call to new backend endpoint (TODO) to copy the files to .contribute-staging
        const contributePromise : any = null;

        // need to open window right now in click handler, it's not allowed
        // in promise handler.
        const newTab = window.open("", "_blank");
        contributePromise.then(() => {
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
}
