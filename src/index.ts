import {
  JupyterFrontEnd, JupyterFrontEndPlugin, IRouter
} from '@jupyterlab/application';
import {ILauncher} from '@jupyterlab/launcher';
import {IFrame} from '@jupyterlab/apputils';
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

export function loadEdcJlab(
    app: JupyterFrontEnd,
    launcher: ILauncher,
    docmanager: IDocumentManager,
    router: IRouter,
) : void {
    // TODO: add copy based on router
    const catalog_cmd = "edc:notebook_catalog";
    const catalog_label = "Notebook Catalog";


    const iframe = new IFrame();

    app.commands.addCommand(catalog_cmd, {
        label: catalog_label,
        execute: () => {
            if (!iframe.isAttached) {
                iframe.url = "https://eurodatacube.com";
                iframe.id = "notebook_catalog";
                iframe.title.label = catalog_label;
                iframe.title.closable = true;
                app.shell.add(iframe, "main");

                const iframeDomElem = document.getElementById(
                    iframe.id
                ).getElementsByTagName("iframe")[0];
                iframeDomElem.addEventListener("load", notifyIFrameUrlChanged);
            } else {
                app.shell.activateById(iframe.id);
            }
        }
    });

    function notifyIFrameUrlChanged(event: Event): void {
        console.log("event:", event)
    }

    launcher.add({
        category: "EDC",
        command: catalog_cmd,
        rank: 0,
    })
}

export default extension;
