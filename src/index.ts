import {
  JupyterFrontEnd, JupyterFrontEndPlugin, IRouter
} from '@jupyterlab/application';
import {ILauncher} from '@jupyterlab/launcher';
import {IFrame, MainAreaWidget, Toolbar, ToolbarButton} from '@jupyterlab/apputils';
import {IDocumentManager} from '@jupyterlab/docmanager';

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

        // NOTE: nbviewer must use the same domain as this
        // TODO: set to production value
        document.domain = "myeox.at";
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
            label: "Download Notebook",
            iconClassName: "fa fa-download",
            enabled: enabled,
            tooltip: enabled ?
                "Download notebook to home directory and open it" :
                "Select a notebook to download",
            onClick: () => deployNotebook(docmanager, currentNbPath),
        });
        toolbar.addItem("copy", toolbarCopyButton);
    }
    refreshToolbar("");
    return {toolbar, refreshToolbar}
}


async function deployNotebook(docmanager: IDocumentManager, nbPath: string): Promise<void> {
    const result = await docmanager.copy(`.shared/${nbPath}`, "");
    docmanager.open(result.path);
    // TODO: tell user that notebook is in root dir?
}


function createWidget(docmanager: IDocumentManager, catalog_label: string): MainAreaWidget<IFrame> {
    const iframe = new IFrame();
    iframe.url = "http://nb.myeox.at/notebooks";  // TODO
    iframe.id = "edc_notebook_catalog";
    iframe.title.label = catalog_label;
    iframe.title.closable = true;

    const {toolbar, refreshToolbar} = createToolbar(docmanager);

    const iframeDomElem = iframe.node.querySelector("iframe");
    iframeDomElem.addEventListener("load", (event: Event ) => {
        const nbPath = getNotebookUrlFromIFrameEvent(event);
        refreshToolbar(nbPath);
    });
    // We need cross domain iframe communication, so we have to
    // remove the sandboxing :-(. However we only load the iframe from our
    // domain, so it you'd have to hack the domain anyway to do damage.
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
    const catalogLabel = "Notebook Catalog";

    let notebookCatalogWidget: MainAreaWidget<IFrame> = null;

    app.commands.addCommand(catalogCommandName, {
        label: catalogLabel,
        // TODO: icon_class
        execute: () => {
            if (!notebookCatalogWidget || !notebookCatalogWidget.isAttached) {
                // it would be nicer to keep the widget instance, but it seems that
                // detaching destroys the layout object of the toolbar :-/
                notebookCatalogWidget = createWidget(docmanager, catalogLabel);
                app.shell.add(notebookCatalogWidget, "main");
            }
            app.shell.activateById(notebookCatalogWidget.id);
        }
    });

    // TODO: icon
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
