// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  IRouter,
} from "@jupyterlab/application";
import { ILauncher } from "@jupyterlab/launcher";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { IFileBrowserFactory } from "@jupyterlab/filebrowser";
import { IMainMenu } from "@jupyterlab/mainmenu";

import { activateVersionLink } from "./versionLink";
import { activateContribute } from "./contribute";
import { activateNotebookCatalog } from "./notebookCatalog";
import { activateCopyByRouter } from "./copyByRouter";
import { activateContestSubmit } from "./contestSubmit";
import { requestAPI } from "./handler";
import { EURODATACUBE_CATALOG } from "./constants";



/**
 * Initialization data for the edc-jlab extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: "edc-jlab",
  autoStart: true,
  requires: [
    ILauncher,
    IDocumentManager,
    IRouter,
    IFileBrowserFactory,
    IMainMenu,
  ],
  activate: async (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    docmanager: IDocumentManager,
    router: IRouter,
    factory: IFileBrowserFactory,
    mainMenu: IMainMenu
  ) => {

    // NOTE: tiles endpoint not used right now, remove if not needed in the end
    const backendData = await Promise.all([requestAPI<any>('catalog'), requestAPI<any>('tiles')]);
    const { name: catalogName, url: catalogUrl } = backendData[0];
    const { services: services, applications: applications } = backendData[1];
    console.log(services)
    console.log(applications)
    activateNotebookCatalog(app, docmanager, launcher, catalogName, catalogUrl);
    activateVersionLink(app, docmanager, mainMenu);
    activateCopyByRouter(app, docmanager, router);
    activateContribute(app, docmanager, factory);

    addIcons(app, launcher);

    if (catalogName != EURODATACUBE_CATALOG) {
      activateContestSubmit(app, factory, catalogName);
    }


    // we set the domain to the last 2 domain parts to be able to communicate with
    // the child frame
    // this code would not work for domains with 3 dots such as a.co.uk.
    document.domain = document.location.hostname.split(".").slice(-2).join(".");
  }
};



// TODO: move to own file
import {
  IFrame,
  MainAreaWidget,
} from "@jupyterlab/apputils";


function createWidget(url: string): MainAreaWidget<IFrame> {
  const iframe = new IFrame();
  iframe.url = url;

  return new MainAreaWidget({
    content: iframe,
  });
}

/**
 */
export function addIcons(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  launcher: ILauncher,
) {
  const category = "EOxHub";

  function createCommand(id: string, label: string, url: string, iconClass: string): string {
    let notebookCatalogWidget: MainAreaWidget<IFrame> = null;
    const catalogCommandName = `edc:notebook_catalog_${id}`;
    app.commands.addCommand(catalogCommandName, {
      label,
      iconClass,
      execute: () => {
        if (!notebookCatalogWidget || !notebookCatalogWidget.isAttached) {
          // it would be nicer to keep the widget instance, but it seems that
          // detaching destroys the layout object of the toolbar :-/
          notebookCatalogWidget = createWidget(url);
          notebookCatalogWidget.title.label = label;
          notebookCatalogWidget.title.iconClass = iconClass;
          notebookCatalogWidget.title.closable = true;
          app.shell.add(notebookCatalogWidget, "main");
        }
        app.shell.activateById(notebookCatalogWidget.id);
      },
    });
    return catalogCommandName;
  }

  launcher.add({
    category,
    command: createCommand("dashboard", "EOxHub Dashboard", `/services/eoxhub-gateway/dashboard`, "eoxhub-dashboard-icon"),
    rank: 100,
  });
}


export default extension;
