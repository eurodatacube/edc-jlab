// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  IRouter
} from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { IMainMenu } from '@jupyterlab/mainmenu';

import { activateVersionLink } from './versionLink';
import { activateNotebookCatalog } from './notebookCatalog';
import { activateCopyByRouter } from './copyByRouter';
import { activateContestSubmit } from './contestSubmit';
import { activateStacDownload } from './stacDownload';
import { requestAPI } from './handler';
import { EURODATACUBE_CATALOG } from './constants';

/**
 * Initialization data for the edc-jlab extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'edc-jlab',
  autoStart: true,
  requires: [
    ILauncher,
    IDocumentManager,
    IRouter,
    IFileBrowserFactory,
    IMainMenu
  ],
  activate: async (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    docmanager: IDocumentManager,
    router: IRouter,
    factory: IFileBrowserFactory,
    mainMenu: IMainMenu
  ) => {
    const { name: catalogName, url: catalogUrl } = await requestAPI<any>(
      'catalog'
    );
    activateNotebookCatalog(app, docmanager, launcher, catalogName, catalogUrl);
    activateVersionLink(app, docmanager, mainMenu);
    activateCopyByRouter(app, docmanager, router);
    activateStacDownload(app, docmanager, factory);

    if (catalogName != EURODATACUBE_CATALOG) {
      activateContestSubmit(app, factory, catalogName);
    }

    // we set the domain to the last 2 domain parts to be able to communicate with
    // the child frame
    // this code would not work for domains with 3 dots such as a.co.uk.
    document.domain = document.location.hostname.split('.').slice(-2).join('.');
  }
};

export default extension;
