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

export type IframeApp = {
  key: string;
  name: string;
  logo: string;
};

function isPathAbsolute(path: string): boolean {
  // there doesn't seem to be a library function to do this
  return /^(?:\/|[a-z]+:\/\/)/.test(path);
}

export function activateIframeApp(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  launcher: ILauncher,
  brand: string,
  service: IframeApp,
  rank: number
) {
  const category = 'Applications';

  let appUrl = `/services/eoxhub-gateway/${brand}/${service.key}/`;
  // Workaround for notebook-view app:
  if (service.key === 'notebook-view') {
      appUrl += '?deploy=jupyterlab';
  }

  const logoUrl = isPathAbsolute(service.logo)
    ? service.logo
    : `https://hub.eox.at/services/eoxhub-gateway/${brand}/${service.logo}`;

  const brandIcon = new LabIcon({
    name: `edc:app_${service.key}`,
    svgstr: `<svg height="100%25" width="100%25" xmlns="http://www.w3.org/2000/svg">
      <image href="${logoUrl}" height="100%25" width="100%25"/>
    </svg>`
  });

  let appWidget: MainAreaWidget<IFrame> = null;
  const catalogCommandName = `edc:service_${service.key}}`;
  app.commands.addCommand(catalogCommandName, {
    label: service.name,
    icon: brandIcon,
    execute: () => {
      if (!appWidget || !appWidget.isAttached) {
        // it would be nicer to keep the widget instance, but it seems that
        // detaching destroys some properties, e.g. the tab title
        appWidget = createWidget(appUrl);
        appWidget.title.label = service.name;
        appWidget.title.icon = brandIcon;
        appWidget.title.closable = true;
        app.shell.add(appWidget, 'main');
      }
      app.shell.activateById(appWidget.id);
    }
  });
  launcher.add({
    category,
    command: catalogCommandName,
    rank: rank
  });
}
