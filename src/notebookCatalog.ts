// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import { InputDialog, Dialog } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Widget } from '@lumino/widgets';
import { requestAPI } from './handler';

class HtmlLabelRenderer extends Dialog.Renderer {
  createBody(value: Dialog.Body<any>): Widget {
    const label = (value as Widget).node.querySelector('label');
    // show html as html
    label.innerHTML = label.innerText;
    return super.createBody(value);
  }
}
/**
 * Ask user about path and copies notebook there
 */
export async function deployNotebook(
  docmanager: IDocumentManager,
  nbPath: string
): Promise<void> {
  // suggest just the filename since it doesn't seem easy to create directories here
  // and also the users probably don't want to mirror the notebook repo dir structure.
  const suggestedPath = nbPath.substring(nbPath.lastIndexOf('/') + 1);

  const selectLabel = `Select a filename for the notebook "${suggestedPath}":`;
  let label = selectLabel;

  // repeat input in case of problems
  let bailout = false;
  while (!bailout) {
    const res = await InputDialog.getText({
      text: suggestedPath,
      title: 'Copy notebook to workspace',
      renderer: new HtmlLabelRenderer(),
      label
    });
    if (!res.button.accept) {
      bailout = true;
    } else {
      const targetPath = res.value as string;
      try {
        await requestAPI<any>('install_notebook', {
          body: JSON.stringify({
            nbPath: nbPath,
            targetPath: targetPath
          }),
          method: 'POST'
        });
        docmanager.open(targetPath);
        bailout = true;
      } catch (e) {
        console.log('error:', e);
        if (e.response && e.response.status === 409) {
          // ok, file exists
        } else {
          throw e;
        }
      }
      if (!bailout) {
        label = `<p><b>Saving failed: existing or wrong filename</b></p>
                <p>If the file "${targetPath}" already exists, you can access it in the filebrowser on the left side of the screen.</p>
                ${selectLabel}`;
      }
    }
  }
}

export function activateNotebookDeploy(docmanager: IDocumentManager) {
  window.addEventListener('message', event => {
    console.log('Handling message event', event.data);
    // events look like: { execute: "curated/EDC_Usecase-NDVI_timeline.ipynb" }
    const nbPath = event.data.execute;
    deployNotebook(docmanager, nbPath);
  });
}
