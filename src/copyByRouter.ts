// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import { JupyterFrontEnd, IRouter } from '@jupyterlab/application';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { deployNotebook } from './notebookCatalog';

/**
 * Enables copying files to the workspace by visiting the url:
 *
 * /lab?copy=/my-notebook.ipynb
 *
 */
export function activateCopyByRouter(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  router: IRouter
) {
  const copyNotebookFromRouterCommandName = 'edc:copyNotebookFromRouter';
  router.register({
    command: copyNotebookFromRouterCommandName,
    pattern: /(\?copy=|&copy=)([^?]+)/
  });

  app.commands.addCommand(copyNotebookFromRouterCommandName, {
    execute: args => {
      console.log('Copy notebook from args: ', args, args.search);
      const path = parseCopyUrlParam(args.search as string);
      if (path) {
        // NOTE: link from url still includes /notebooks/eurodatacube/notebooks
        //       which we must remove for the current version
        const pathCorrected = path.replace(
          /^\/notebooks\/eurodatacube\/notebooks\//,
          ''
        );
        return deployNotebook(docmanager, pathCorrected);
      }
    }
  });
}
export function parseCopyUrlParam(search: string): string | null {
  const urlParams = new URLSearchParams(search);
  if (urlParams.has('reset')) {
    console.log('Url is being reset, not triggering copy');
    return null;
  } else {
    const path = urlParams.get('copy');
    console.log('Parsed URL parameters:', urlParams.toString(), path);
    return path;
  }
}
