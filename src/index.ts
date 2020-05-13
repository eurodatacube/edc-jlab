// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import {
    JupyterFrontEnd, JupyterFrontEndPlugin, IRouter
} from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';
import {
    IFrame, InputDialog,
    MainAreaWidget,
    Toolbar,
    ToolbarButton,
    Dialog,
} from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Widget } from '@lumino/widgets';

import { IFileBrowserFactory, FileBrowser } from '@jupyterlab/filebrowser';
import { Contents } from '@jupyterlab/services';
import { toArray } from '@lumino/algorithm';


const SHARED_FOLDER = ".shared";
// TODO: setup these folders in user shares
const CONTRIBUTE_STAGING_PATH = ".contribute-staging";

const EDC_ICON_CLASS = "notebook-catalog-icon";

// NOTE: this is somewhat of a hack, but it works fine for prod, dev and local.
//       we'd need to add some kind of instance-wide configuration to do this properly.
const NBVIEWER_IFRAME_URL =
    document.location.origin.replace("jupyter", "nbviewer") + "/notebooks";

/**
 * Initialization data for the edc-jlab extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
    id: 'edc-jlab',
    autoStart: true,
    requires: [ILauncher, IDocumentManager, IRouter, IFileBrowserFactory],
        activate: (
            app: JupyterFrontEnd,
            launcher: ILauncher,
            docmanager: IDocumentManager,
            router: IRouter,
            factory: IFileBrowserFactory
        ) => {
        activateNotebookCatalog(app, docmanager, launcher);
        activateCopyByRouter(app, docmanager, router);
        activateContribute(app, docmanager, factory);

        // we set the domain to the last 2 domain parts to be able to communicate with
        // the child frame
        // this code would not work for domains with 3 dots such as a.co.uk.
        document.domain = document.location.hostname.split(".").slice(-2).join(".");

        // NOTE: enable this to run test (yes, this approach is better than wasting
        //       hours trying to get jest to run in a ts setup with custom settings)
        const run_tests = false;
        if (run_tests) {
            test();
        }
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

    // NOTE: nbviewer url path and notebook path are the same, but this is an accident!
    //       nbviewer uses "/notebooks" as url prefix to serve local files. But also
    //       the main directory of the notebooks is called "notebooks", and nbviewer
    //       services files directly from this directory.
    return newPathname;
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
        toolbarCopyButton = new ToolbarButton({
            label: "Execute Notebook",
            iconClass: "fa fa-download",
            enabled: enabled,
            tooltip: enabled ?
                "Execute notebook to home directory and open it" :
                "Select a notebook to execute",
            onClick: () => deployNotebook(docmanager, currentNbPath),
        });
        toolbar.addItem("copy", toolbarCopyButton);
    }
    refreshToolbar("");
    return { toolbar, refreshToolbar }
}


class HtmlLabelRenderer extends Dialog.Renderer {
    createBody(value: Dialog.Body<any>): Widget {
        const label = (value as Widget).node.querySelector("label")
        // show html as html
        label.innerHTML = label.innerText;
        return super.createBody(value);
    }
}


/**
 * Ask user about path and copies notebook there
 */
async function deployNotebook(docmanager: IDocumentManager, nbPath: string): Promise<void> {
    // suggest just the filename since it doesn't seem easy to create directories here
    // and also the users probably don't want to mirror the notebook repo dir structure.
    const suggestedPath = nbPath.substring(nbPath.lastIndexOf("/") + 1);

    const selectLabel = `Select a filename for the notebook "${suggestedPath}":`
    let label = selectLabel;

    // repeat input in case of problems
    let bailout = false;
    while (!bailout) {
        const res = await InputDialog.getText({
            text: suggestedPath,
            title: "Copy notebook to workspace",
            renderer: new HtmlLabelRenderer,
            label,
        });
        if (!res.button.accept) {
            bailout = true;
        } else {
            const targetPath = res.value as string;
            bailout = await copyNotebookTo(docmanager, nbPath, targetPath);
            if (!bailout) {
                label = `<p><b>Saving failed: existing or wrong filename</b></p>
                <p>If the file "${targetPath}" already exists, you can access it in the filebrowser on the left side of the screen.</p>
                ${selectLabel}`;
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
    console.log(
        `Copy notebook "${nbPath}" from shared "${SHARED_FOLDER}" to "${targetPath}"`
    );
    const copyResult = await docmanager.copy(`${SHARED_FOLDER}/${nbPath}`, "");
    try {
        const renameResult = await docmanager.rename(copyResult.path, targetPath);
        docmanager.open(renameResult.path);
        return true;
    } catch (ex) {
        await docmanager.deleteFile(copyResult.path);
        return false;
    }
}


function createWidget(docmanager: IDocumentManager): MainAreaWidget<IFrame> {
    const iframe = new IFrame();
    iframe.url = NBVIEWER_IFRAME_URL;

    const { toolbar, refreshToolbar } = createToolbar(docmanager);

    const iframeDomElem = iframe.node.querySelector("iframe");
    iframeDomElem.addEventListener("load", (event: Event) => {
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

    let notebookCatalogWidget: MainAreaWidget<IFrame> = null;

    app.commands.addCommand(catalogCommandName, {
        label: catalogLabel,
        iconClass: EDC_ICON_CLASS,
        execute: () => {
            if (!notebookCatalogWidget || !notebookCatalogWidget.isAttached) {
                // it would be nicer to keep the widget instance, but it seems that
                // detaching destroys the layout object of the toolbar :-/
                notebookCatalogWidget = createWidget(docmanager);
                notebookCatalogWidget.title.label = catalogLabel;
                notebookCatalogWidget.title.iconClass = EDC_ICON_CLASS;
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
        pattern: /(\?copy=|&copy=)([^?]+)/,
    });

    app.commands.addCommand(copyNotebookFromRouterCommandName, {
        execute: (args) => {
            console.log("Copy notebook from args: ", args, args.search);
            const path = parseCopyUrlParam(args.search as string);
            if (path) {
                return deployNotebook(docmanager, path);
            }
        }
    });
}

function parseCopyUrlParam(search: string): string | null {
    const urlParams = new URLSearchParams(search);
    const path = urlParams.get("copy");
    console.log("Parsed URL parameters:", urlParams.toString(), path);
    return path;
}


/**
 * Add a context menu entry which triggers contributions
 */
function activateContribute(
    app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
    docmanager: IDocumentManager,
    factory: IFileBrowserFactory,
) {
    const contributeCommandId = "edc:contribute";
    app.commands.addCommand(contributeCommandId, {
        label: "EDC contribute",
        iconClass: EDC_ICON_CLASS,
        execute: () => {
            const filebrowser: FileBrowser = factory.tracker.currentWidget;
            if (!filebrowser) {
                return;
            }

            const items = toArray(filebrowser.selectedItems());
            console.log("Contribute items:", items);
            if (items.length > 0) {
                items.map((item: Contents.IModel) => {
                    return docmanager.copy(item.path, CONTRIBUTE_STAGING_PATH);
                });
                // NOTE: we can't actually wait for the promises to resolve because
                //       afterwards we're not in the click handler any more and then
                //       we're not allowed to open tabs :(
                // TODO: open according contribute page (dev/prod)
                window.open("https://www.asdf.com");
            }
        }
    })

    // selector as from packages/filebrowser-extension/src/index.ts
    const selectorNotDir = '.jp-DirListing-item[data-isdir="false"]';

    app.contextMenu.addItem({
        selector: selectorNotDir,
        command: contributeCommandId,
    });
}


/**
 * It's so ridiculously hard to just run some ts code in current js ecosystem
 * if you have a setup that's a tiny bit different from the example setup. Both
 * using jest-ts and babel result in random errors in some dependency.
 * The only environment where you actually can run this code is in the browser when
 * the complete bundle is built, so we have to rely on that.
 */
function test() {
    // regular copy
    console.assert(parseCopyUrlParam("?copy=foo/bar") == "foo/bar");
    // escaped url parameters after login redirect
    console.assert(parseCopyUrlParam("?copy=foo%2Fbar&redirect=1") == "foo/bar");
}


export default extension;
