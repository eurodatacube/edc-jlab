// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import { JupyterFrontEnd } from "@jupyterlab/application";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { IFileBrowserFactory, FileBrowser } from "@jupyterlab/filebrowser";
import { toArray } from "@lumino/algorithm";
import { NOTEBOOK_ICON_CLASS } from "./constants";


/**
 * Add a context menu triggering stac item download
 */
export function activateStacDownload(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  factory: IFileBrowserFactory) {
  const downloadCommand = "eoxhub:stac-download";
  app.commands.addCommand(downloadCommand, {
    label: "EOxHub: Download stac item",
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
      // allow operation or all json files
      return files[0].mimetype == "application/json";
    },
    execute: () => {
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return;
      }

      const items = toArray(filebrowser.selectedItems());
      console.log(
        "downloading items:",
        items.map((item) => item.path).join(", ")
      );
      if (items.length > 0) {
        // TODO: make call to new backend endpoint (TODO) to copy the files to .contribute-staging

      }
    },
  });

  // selector as from packages/filebrowser-extension/src/index.ts
  const selectorNotDir = '.jp-DirListing-item[data-isdir="false"]';

  app.contextMenu.addItem({
    selector: selectorNotDir,
    command: downloadCommand,
    rank: 9, // about at the end of file-operations
  });
}
