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
    // TODO: add copy based on router if needed
    const catalog_cmd = "edc:notebook_catalog";
    const catalog_label = "Notebook Catalog";

    const iframe = new IFrame();
    iframe.url = "http://nb.myeox.at/notebooks";
    iframe.id = "notebook_catalog";
    iframe.title.label = catalog_label;
    iframe.title.closable = true;

    const iframeDomElem = iframe.node.querySelector("iframe");
    iframeDomElem.addEventListener("load", notifyIFrameUrlChanged);
    // We need cross domain iframe communication, so we have to
    // remove the sandboxing :-(. However we only load the iframe from our
    // domain, so it you'd have to hack the domain anyway to do damage.
    iframeDomElem.removeAttribute("sandbox");

    app.commands.addCommand(catalog_cmd, {
        label: catalog_label,
        // TODO: icon_class
        execute: () => {
            if (!iframe.isAttached) {
                app.shell.add(iframe, "main");
            }
            app.shell.activateById(iframe.id);
        }
    });

    function notifyIFrameUrlChanged(event: Event): void {
        const newPathname = (event.target as HTMLIFrameElement).contentWindow.location.pathname;
        // pathname is something like /notebooks/a/b/c/nb.ipynb
        const prefix = "/notebooks";
        if (!newPathname.startsWith((prefix))) {
            console.warn("Ignoring new iframe url " + newPathname);
            return;
        }

        const nbPath = newPathname.substring(prefix.length);
        console.log("nbpath", nbPath)
    }

    // TODO: icon
    launcher.add({
        category: "Euro Data Cube",
        command: catalog_cmd,
        rank: 0,
    });

    console.log("old doc dom", document.domain);
    document.domain = "myeox.at";
    console.log("new doc dom", document.domain);
}

export default extension;
