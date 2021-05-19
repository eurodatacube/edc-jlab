// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  IRouter,
} from "@jupyterlab/application";
import { ILauncher } from "@jupyterlab/launcher";
import {
  IFrame,
  InputDialog,
  MainAreaWidget,
  Toolbar,
  ToolbarButton,
  Dialog,
} from "@jupyterlab/apputils";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { IFileBrowserFactory, FileBrowser } from "@jupyterlab/filebrowser";
import { IMainMenu } from "@jupyterlab/mainmenu";
import { Contents } from "@jupyterlab/services";
import { toArray } from "@lumino/algorithm";
import { Widget } from "@lumino/widgets";
import { requestAPI } from "./handler";

// TODO: setup these folders in user shares
const CONTRIBUTE_STAGING_PATH = ".contribute-staging";

const EDC_ICON_CLASS = "notebook-catalog-icon";


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
    await activateNotebookCatalog(app, launcher);
    activateVersionLink(app, docmanager, mainMenu);
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
  },
};

function getNotebookUrlFromIFrameEvent(event: Event): string | null {
  const newPathname = (event.target as HTMLIFrameElement).contentWindow.location
    .pathname;
  // pathname is something like /notebooks/a/b/c/nb.ipynb
  const prefix = "/notebooks";
  if (!newPathname.startsWith(prefix)) {
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

function createToolbar() {
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
      tooltip: enabled
        ? "Execute notebook to home directory and open it"
        : "Select a notebook to execute",
      onClick: () => deployNotebook(currentNbPath),
    });
    toolbar.addItem("copy", toolbarCopyButton);
  }
  refreshToolbar("");
  return { toolbar, refreshToolbar };
}

class HtmlLabelRenderer extends Dialog.Renderer {
  createBody(value: Dialog.Body<any>): Widget {
    const label = (value as Widget).node.querySelector("label");
    // show html as html
    label.innerHTML = label.innerText;
    return super.createBody(value);
  }
}

/**
 * Ask user about path and copies notebook there
 */
async function deployNotebook(
  nbPath: string
): Promise<void> {
  // suggest just the filename since it doesn't seem easy to create directories here
  // and also the users probably don't want to mirror the notebook repo dir structure.
  const suggestedPath = nbPath.substring(nbPath.lastIndexOf("/") + 1);

  const selectLabel = `Select a filename for the notebook "${suggestedPath}":`;
  let label = selectLabel;

  // repeat input in case of problems
  let bailout = false;
  while (!bailout) {
    const res = await InputDialog.getText({
      text: suggestedPath,
      title: "Copy notebook to workspace",
      renderer: new HtmlLabelRenderer(),
      label,
    });
    if (!res.button.accept) {
      bailout = true;
    } else {
      const targetPath = res.value as string;
      try {
        await requestAPI<any>(
          'install_notebook',
          {
            body: JSON.stringify({
              nbPath: nbPath,
              targetPath: targetPath,
            }),
            method: "POST",
          },
        )
        bailout = true;
      } catch (e) {
        console.log("error:", e)
        if (e.response && e.response.status === 409) {
          // ok, file exists
        } else {
          throw e;
        }
      }
      if (!bailout) {
        label = `<p><b>Saving failed: existing or wrong filename</b></p>
                <p>If the file "${targetPath}" already exists, you can access it in the filebrowser on the left side of the screen.</p>
                ${selectLabel}`;
      }
    }
  }
}



function createWidget(catalog_url: string): MainAreaWidget<IFrame> {
  const iframe = new IFrame();
  iframe.url = catalog_url;

  const { toolbar, refreshToolbar } = createToolbar();

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
async function activateNotebookCatalog(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  launcher: ILauncher
) {
  const category = "EOxHub"
  const { name: catalog_name, url: catalog_url } = await requestAPI<any>('catalog')

  function createCommand(name: string, url: string): string {
    let notebookCatalogWidget: MainAreaWidget<IFrame> = null;
    const catalogCommandName = `edc:notebook_catalog_${name}`;
    const label = `${catalog_name} ${name}`
    app.commands.addCommand(catalogCommandName, {
      label,
      iconClass: EDC_ICON_CLASS,
      execute: () => {
        if (!notebookCatalogWidget || !notebookCatalogWidget.isAttached) {
          // it would be nicer to keep the widget instance, but it seems that
          // detaching destroys the layout object of the toolbar :-/
          notebookCatalogWidget = createWidget(url);
          notebookCatalogWidget.title.label = label;
          notebookCatalogWidget.title.iconClass = EDC_ICON_CLASS;
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
    command: createCommand("Readme", `${catalog_url}/README.ipynb`),
    rank: 0,
  });
  launcher.add({
    category,
    command: createCommand("Catalog", catalog_url),
    rank: 1,
  });
}

function activateVersionLink(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  mainMenu: IMainMenu
) {
  const kernelspecs = docmanager.services.kernelspecs.specs.kernelspecs;
  // use "first" kernelspec
  const kernelSpec = Object.values(kernelspecs).pop();
  // use custom version info added to base images
  const version = kernelSpec.metadata.version;

  const versionLinkCommand = "edc:goto-version";

  app.commands.addCommand(versionLinkCommand, {
    label: `Python libraries in the ${kernelSpec.display_name} Kernel`,
    iconClass: EDC_ICON_CLASS,
    execute: () => {
      window.open(
        `https://github.com/eurodatacube/base-images/releases/tag/user-${version}`
      );
    },
  });

  // 21 is right below the official kernel info, which is 20
  mainMenu.helpMenu.addGroup([{ command: versionLinkCommand }], 21);
}

/**
 * Enables copying files to the workspace by visiting the url:
 *
 * /lab?copy=/my-notebook.ipynb
 *
 */
function activateCopyByRouter(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  router: IRouter
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
        return deployNotebook(path);
      }
    },
  });
}

function parseCopyUrlParam(search: string): string | null {
  const urlParams = new URLSearchParams(search);
  const path = urlParams.get("copy");
  console.log("Parsed URL parameters:", urlParams.toString(), path);
  return path;
}

async function ensureStatingDirExists(
  contents: Contents.IManager
): Promise<void> {
  // We should check if the dir exists, but we the server doesn't allow accessing
  // hidden files. However we can create it and check if the response is 409 conflict.
  // Also, the API doesn't allow creating dirs, only untitled dirs which are later
  // renamed.
  console.log(`Trying to create ${CONTRIBUTE_STAGING_PATH}`);
  const dir = await contents.newUntitled({ type: "directory" });
  try {
    try {
      await contents.rename(dir.name, CONTRIBUTE_STAGING_PATH);
    } catch (error) {
      if (error.response.status == 404) {
        // this means success, lol. probably the server filters hidden dirs, so
        // it doesn't find the dir it has renamed.
        console.log("Created dir successfully");
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error.response.status == 409) {
      // CONFLICT
      await contents.delete(dir.name);
      console.log("Directory already exists");
    } else {
      throw error;
    }
  }
}

/**
 * Add a context menu entry which triggers contributions
 */
function activateContribute(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  factory: IFileBrowserFactory
) {
  const contributeCommandId = "edc:contribute";
  app.commands.addCommand(contributeCommandId, {
    label: "EDC: Contribute Notebook",
    iconClass: EDC_ICON_CLASS,
    isVisible: () => {
      // NOTE: market place is currently restricted to 1 contributed file
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return false;
      }
      const files = toArray(filebrowser.selectedItems());
      if (files.length !== 1) {
        return false;
      }
      return files[0].type === "notebook";
    },
    execute: () => {
      const filebrowser: FileBrowser = factory.tracker.currentWidget;
      if (!filebrowser) {
        return;
      }

      const items = toArray(filebrowser.selectedItems());
      console.log(
        "Contribute items:",
        items.map((item) => item.path).join(", ")
      );
      if (items.length > 0) {
        const copyPromises = items.map(async (item: Contents.IModel) => {
          // make sure to delete target first in case it's an update
          try {
            await docmanager.deleteFile(
              `${CONTRIBUTE_STAGING_PATH}/${item.name}`
            );
          } catch (error) {
            // 404 error is expected, everything else is bad
            if (error.response.status !== 404) {
              throw error;
            }
          }

          return docmanager.copy(item.path, CONTRIBUTE_STAGING_PATH);
        });

        // need to open window right now in click handler, it's not allowed
        // in promise handler.
        const newTab = window.open("", "_blank");
        Promise.all(copyPromises)
          .then(() => {
            // TODO: open according contribute page (dev/prod)
            // NOTE: market place is currently restricted to 1 contributed file
            newTab.location.href = `https://eurodatacube.com/contributions/jupyter-notebook/new/${items[0].name}`;
          })
          .catch(() => {
            newTab.close();
            alert("Failed to contribute files.");
          });
      }
    },
  });

  // selector as from packages/filebrowser-extension/src/index.ts
  const selectorNotDir = '.jp-DirListing-item[data-isdir="false"]';

  app.contextMenu.addItem({
    selector: selectorNotDir,
    command: contributeCommandId,
    rank: 9, // about at the end of file-operations
  });

  ensureStatingDirExists(docmanager.services.contents);
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
