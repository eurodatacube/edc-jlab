// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.


import { JupyterFrontEnd } from "@jupyterlab/application";
import { ILauncher } from "@jupyterlab/launcher";
import {
  IFrame,
  InputDialog,
  MainAreaWidget,
  Toolbar,
  ToolbarButton,
  Dialog
} from "@jupyterlab/apputils";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { Widget } from "@lumino/widgets";
import { requestAPI } from "./handler";

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
      tooltip: enabled
        ? "Execute notebook to home directory and open it"
        : "Select a notebook to execute",
      onClick: () => deployNotebook(docmanager, currentNbPath),
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
export async function deployNotebook(
  docmanager: IDocumentManager,
  nbPath: string,
  viaEoxhubGateway: boolean = false,
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
              viaEoxhubGateway: viaEoxhubGateway,
              host: document.location.hostname,
            }),
            method: "POST",
          }
        );
        docmanager.open(targetPath);
        bailout = true;
      } catch (e) {
        console.log("error:", e);
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
function createWidget(docmanager: IDocumentManager, catalogUrl: string): MainAreaWidget<IFrame> {
  const iframe = new IFrame();
  iframe.url = catalogUrl;

  const { toolbar, refreshToolbar } = createToolbar(docmanager);

  // old method with watching iframe content
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
export function activateNotebookCatalog(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  launcher: ILauncher,
  catalogName: string,
  catalogUrl: string,
) {
  const category = "EOxHub";

  window.addEventListener("message", (event) => {
    console.log("Handling message event", event.data);
    // events look like: { execute: "curated/EDC_Usecase-NDVI_timeline.ipynb" }
    const nbPath = event.data.execute;
    deployNotebook(docmanager, nbPath, true);
  });


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
          notebookCatalogWidget = createWidget(docmanager, url);
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
  // compatibility: older catalog urls needed {catalogName}/notebooks postfix
  // the more recent notebook-view doesn't, so let's support both for a while
  const catalogNotebooksBaseUrl = catalogUrl.endsWith("notebook-view/") ? catalogUrl : `${catalogUrl}/${catalogName}/notebooks`;
  launcher.add({
    category,
    command: createCommand("catalog", catalogName, catalogNotebooksBaseUrl, "catalog-icon"),
    rank: 1,
  });
}
