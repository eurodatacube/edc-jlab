// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.
//
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';
import { IFrame, MainAreaWidget } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';

function createWidget(appUrl: string): MainAreaWidget<IFrame> {
  const iframe = new IFrame();
  iframe.url = appUrl;

  const iframeDomElem = iframe.node.querySelector('iframe');
  iframeDomElem.removeAttribute('sandbox');

  return new MainAreaWidget({
    content: iframe
  });
}

export function activateIframeApp(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  launcher: ILauncher,
  brand: string,
  service: string
) {
  const category = 'EOxHub Applications';

  const logoUrl = `https://hub.eox.at/services/eoxhub-gateway/${brand}/brand-logo`;
  const brandIcon = new LabIcon({
    name: 'edc:brand',
    svgstr: `<svg height="100%25" width="100%25" xmlns="http://www.w3.org/2000/svg">
      <image href="${logoUrl}" height="100%25" width="100%25"/>
    </svg>`
  })

  function createCommand(id: string, label: string, url: string): string {
    let appWidget: MainAreaWidget<IFrame> = null;
    const catalogCommandName = `edc:${service}_${id}`;
    app.commands.addCommand(catalogCommandName, {
      label,
      icon: brandIcon,
      execute: () => {
        if (!appWidget || !appWidget.isAttached) {
          // it would be nicer to keep the widget instance, but it seems that
          // detaching destroys some properties, e.g. the tab title
          appWidget = createWidget(url);
          appWidget.title.label = label;
          appWidget.title.icon = brandIcon;
          appWidget.title.closable = true;
          app.shell.add(appWidget, 'main');
        }
        app.shell.activateById(appWidget.id);
      }
    });
    return catalogCommandName;
  }
  const appUrl = `/services/eoxhub-gateway/${brand}/${service}/`;
  launcher.add({
    category,
    command: createCommand(service, service, appUrl),
    rank: 1
  });
}
