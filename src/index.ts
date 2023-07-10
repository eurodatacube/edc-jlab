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
import { activateNotebookDeploy } from './notebookCatalog';
import { activateCopyByRouter } from './copyByRouter';
import { activateStacDownload } from './stacDownload';
import { activateIframeApp } from './iframeApp';
import { requestAPI } from './handler';

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
    const { brand: brand } = await requestAPI<any>('brand');
    const { services: eoxhubServices } = await requestAPI<any>(
      'whoami',
      {},
      `/services/eoxhub-gateway/${brand}`
    );
    eoxhubServices.forEach((service: string) => {
      activateIframeApp(app, launcher, brand, service);
    });
    activateNotebookDeploy(docmanager);
    activateVersionLink(app, docmanager, mainMenu);
    activateCopyByRouter(app, docmanager, router);
    activateStacDownload(app, docmanager, factory);

    // we set the domain to the last 2 domain parts to be able to communicate with
    // the child frame
    // this code would not work for domains with 3 dots such as a.co.uk.
    document.domain = document.location.hostname.split('.').slice(-2).join('.');
  }
};

export default extension;
