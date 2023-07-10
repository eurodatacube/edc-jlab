// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog, showDialog, showErrorMessage } from '@jupyterlab/apputils';
import { IFileBrowserFactory, FileBrowser } from '@jupyterlab/filebrowser';
import { toArray } from '@lumino/algorithm';
import { NOTEBOOK_ICON_CLASS } from './constants';
import { requestAPI } from './handler';

/**
 * Add a context menu entry which triggers contest submission
 */
export function activateContestSubmit(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  factory: IFileBrowserFactory,
  contestName: string
) {
  const commandId = 'edc:contest-submit';
  app.commands.addCommand(commandId, {
    label: `EDC: Submit directory for ${contestName}`,
    iconClass: NOTEBOOK_ICON_CLASS,
    isVisible: () => {
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return false;
      }
      const files = toArray(filebrowser.selectedItems());
      if (files.length !== 1) {
        return false;
      }
      return files[0].type === 'directory';
    },
    execute: async () => {
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return;
      }

      const items = toArray(filebrowser.selectedItems());
      if (items.length === 1) {
        const path = items[0].path;
        console.log('Contest submit directory:', path);

        const result = await showDialog({
          title: `Submission for ${contestName}`,
          body: `Do you really want to submit ${path} for ${contestName}?`,
          buttons: [Dialog.cancelButton(), Dialog.okButton()]
        });
        if (result.button.accept) {
          await doSubmit(path);
        }
      } else {
        console.error('Submit called with bad number of dirs', items);
      }
    }
  });

  // selector as from packages/filebrowser-extension/src/index.ts
  const selectorNotDir = '.jp-DirListing-item[data-isdir="true"]';

  app.contextMenu.addItem({
    selector: selectorNotDir,
    command: commandId,
    rank: 9 // about at the end of file-operations
  });

  async function doSubmit(path: string) {
    try {
      await requestAPI<any>('contest_submit', {
        body: JSON.stringify({ directory: path }),
        method: 'POST'
      });
      showDialog({
        title: 'Contest submission successful',
        body: 'Your contest entry has been submitted successfully!',
        buttons: [Dialog.okButton()]
      });
    } catch (e) {
      console.log('error:', e);
      showErrorMessage(
        'Contest submit failed',
        `Failed to submit directory for contest: ${e}`
      );
    }
  }
}
