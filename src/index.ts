// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import {
  JupyterFrontEnd, JupyterFrontEndPlugin, IRouter
} from '@jupyterlab/application';
import {ILauncher} from '@jupyterlab/launcher';
import {
    IFrame, InputDialog,
    MainAreaWidget,
    Toolbar,
    ToolbarButton
} from '@jupyterlab/apputils';
import {IDocumentManager} from '@jupyterlab/docmanager';


const SHARED_FOLDER = ".shared";
const NBVIEWER_IFRAME_URL = "https://edc-dev-nbviewer.hub.eox.at/notebooks";  // TODO

/**
 * Initialization data for the edc-jlab extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
    id: 'edc-jlab',
    autoStart: true,
    requires: [ILauncher, IDocumentManager, IRouter],
    activate: (app: JupyterFrontEnd, launcher: ILauncher, docmanager: IDocumentManager, router: IRouter) => {
        activateNotebookCatalog(app, docmanager, launcher);
        activateCopyByRouter(app, docmanager, router);

         // we set the domain to the last 2 domain parts to be able to communicate with
        // the child frame
        // this code would not work for domains with 3 dots such as a.co.uk.
        document.domain = document.location.hostname.split(".").slice(-2).join(".");
    }
};


function getNotebookUrlFromIFrameEvent(event: Event): string | null {
    const newPathname = (event.target as HTMLIFrameElement).contentWindow.location.pathname;
    // pathname is something like /notebooks/a/b/c/nb.ipynb
    const prefix = "/notebooks";
    if (!newPathname.startsWith((prefix))) {
        console.warn(`Ignoring new iframe url ${newPathname}`);
        return null;
    }
    return newPathname.substring(prefix.length);
}


function isNotebookFile(nbPath: string): boolean {
    return nbPath.endsWith(".ipynb");
}


function createToolbar(docmanager: IDocumentManager) {
    const toolbar = new Toolbar();
    toolbar.addClass("edc-toolbar");
    let toolbarCopyButton: ToolbarButton | null = null;

    function refreshToolbar(currentNbPath: string): void {
        // there doesn't seem to be a way to toggle "enable", so we re-add the button
        // every time.
        if (toolbarCopyButton) {
            toolbar.layout!.removeWidget(toolbarCopyButton);
        }
        const enabled = isNotebookFile(currentNbPath);
        toolbarCopyButton = new ToolbarButton( {
            label: "Execute Notebook",
            iconClassName: "fa fa-download",
            enabled: enabled,
            tooltip: enabled ?
                "Execute notebook to home directory and open it" :
                "Select a notebook to execute",
            onClick: () => deployNotebook(docmanager, currentNbPath),
        });
        toolbar.addItem("copy", toolbarCopyButton);
    }
    refreshToolbar("");
    return {toolbar, refreshToolbar}
}


/**
 * Ask user about path and copies notebook there
 */
async function deployNotebook(docmanager: IDocumentManager, nbPath: string): Promise<void> {
    // NOTE: this downloads the whole notebook just to display the metadata. I haven't
    //       yet found a better way to do this. We'll need to disable this if the
    //       notebooks are too large.
    const nbModel = await docmanager.services.contents.get(`/${SHARED_FOLDER}/${nbPath}` );
    const properties =
        (nbModel.content.metadata && nbModel.content.metadata.properties) ?
            nbModel.content.metadata.properties :
            {};
    const nbName = properties.name;
    const nbVersion = properties.version;
    const selectLabel = (nbName && nbVersion) ?
        `Select a file path to copy the notebook "${nbName}" (version: ${nbVersion}) to:` :
        "Select a file path to copy the notebook to:";
    let label = selectLabel;

    // repeat input in case of problems
    let bailout = false;
    while (!bailout) {
        const res = await InputDialog.getText({
            text: nbPath,
            title: "Copy notebook to workspace",
            label,
        });
        if (!res.button.accept) {
            bailout = true;
        } else {
            const targetPath = res.value as string;
            bailout = await copyNotebookTo(docmanager, nbPath, targetPath);
            if (!bailout) {
                // TODO: make this more beautiful
                label = `Failed to upload to name "${targetPath}". ${selectLabel}`;
            }
        }
    }
}


/**
 * Downloads notebook to desired path
 */
async function copyNotebookTo(docmanager: IDocumentManager, nbPath: string, targetPath: string) {
    // copy doesn't allow specifying a target filename, only a target dir
    // rename however does support a directory move + new name, so we combine
    // these operations.
    const copyResult = await docmanager.copy(`${SHARED_FOLDER}/${nbPath}`, "");
    try {
        const renameResult = await docmanager.rename(copyResult.path, targetPath);
        await docmanager.open(renameResult.path);
        return true;
    } catch (ex) {
        await docmanager.deleteFile(copyResult.path);
        return false;
    }
}


function createWidget(docmanager: IDocumentManager): MainAreaWidget<IFrame> {
    const iframe = new IFrame();
    iframe.url = NBVIEWER_IFRAME_URL;

    const {toolbar, refreshToolbar} = createToolbar(docmanager);

    const iframeDomElem = iframe.node.querySelector("iframe");
    iframeDomElem.addEventListener("load", (event: Event ) => {
        const nbPath = getNotebookUrlFromIFrameEvent(event);
        refreshToolbar(nbPath);
    });
    // We need cross domain iframe communication, so we have to
    // remove the sandboxing :-(. However we only load the iframe from our
    // domain, so it you'd have to hack the domain anyway to do damage. Also
    // the nbviewer has a very small attack surface.
    iframeDomElem.removeAttribute("sandbox");

    return new MainAreaWidget({
        content: iframe,
        toolbar,
    });
}


/**
 * Add a notebook catalog accessible via launcher icon. Shows notebooks in an own
 * tab with an nbviewer iframe and a copy button.
 */
function activateNotebookCatalog(
    app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
    docmanager: IDocumentManager,
    launcher: ILauncher,
) {
    const catalogCommandName = "edc:notebook_catalog";
    const catalogLabel = "EDC Notebook Catalog";
    const catalogIconClass = "notebook-catalog-icon";

    let notebookCatalogWidget: MainAreaWidget<IFrame> = null;

    app.commands.addCommand(catalogCommandName, {
        label: catalogLabel,
        iconClass: catalogIconClass,
        execute: () => {
            if (!notebookCatalogWidget || !notebookCatalogWidget.isAttached) {
                // it would be nicer to keep the widget instance, but it seems that
                // detaching destroys the layout object of the toolbar :-/
                notebookCatalogWidget = createWidget(docmanager);
                notebookCatalogWidget.title.label = catalogLabel;
                notebookCatalogWidget.title.iconClass = catalogIconClass;
                notebookCatalogWidget.title.closable = true;
                app.shell.add(notebookCatalogWidget, "main");
            }
            app.shell.activateById(notebookCatalogWidget.id);
        }
    });

    launcher.add({
        category: "Euro Data Cube",
        command: catalogCommandName,
        rank: 0,
    });
}


/**
 * Enables copying files to the workspace by visiting the url:
 *
 * /lab?copy/my-notebook.ipynb
 *
 */
function activateCopyByRouter(
    app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
    docmanager: IDocumentManager,
    router: IRouter,
) {
    const copyNotebookFromRouterCommandName = "edc:copyNotebookFromRouter";
    router.register({
        command: copyNotebookFromRouterCommandName,
        pattern: /(\?copy|&copy)([^?]+)/,
    });

    app.commands.addCommand(copyNotebookFromRouterCommandName, {
        execute: (args) => {
            const path = (args.search as string).replace('?copy', '');
            return deployNotebook(docmanager, path);
        }
    });
}

export default extension;
