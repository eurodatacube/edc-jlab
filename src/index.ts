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
    activate: loadEdcJlab,
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
            tooltip: enabled?
                "Download notebook to home directory and open it" :
                "Select a notebook to download",
            onClick: async () => {
                const result = await docmanager.copy(`.shared/${currentNbPath}`, "");
                docmanager.open(result.path);
                // TODO: tell user that notebook is in root dir
            }
        });
        toolbar.addItem("copy", toolbarCopyButton);
    }
    refreshToolbar("");
    return {toolbar, refreshToolbar}
}


function createIFrame(docmanager: IDocumentManager, catalog_label: string) {
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

    return {iframe, toolbar};
}

export function loadEdcJlab(
    app: JupyterFrontEnd,
    launcher: ILauncher,
    docmanager: IDocumentManager,
    router: IRouter,
) : void {
    // TODO: add copy based on router if needed
    const catalog_cmd = "edc:notebook_catalog";
    const catalog_label = "Notebook Catalog";

    const {iframe, toolbar} = createIFrame(docmanager, catalog_label);

    const notebookCatalogWidget = new MainAreaWidget({
        content: iframe,
        toolbar,
    });

    app.commands.addCommand(catalog_cmd, {
        label: catalog_label,
        // TODO: icon_class
        execute: () => {
            if (!notebookCatalogWidget.isAttached) {
                app.shell.add(notebookCatalogWidget, "main");
            }
            app.shell.activateById(notebookCatalogWidget.id);
        }
    });

    // TODO: icon
    launcher.add({
        category: "Euro Data Cube",
        command: catalog_cmd,
        rank: 0,
    });

    // NOTE: nbviewer must use the same domain as this
    // TODO: set to production value
    document.domain = "myeox.at";
}

export default extension;
