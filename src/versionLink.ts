// Author: Bernhard Mallinger
// Copyright (c) EOX IT Services
// Distributed under the terms of the MIT License.

import { JupyterFrontEnd } from '@jupyterlab/application';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { NOTEBOOK_ICON_CLASS } from './constants';

export function activateVersionLink(
  app: JupyterFrontEnd<JupyterFrontEnd.IShell>,
  docmanager: IDocumentManager,
  mainMenu: IMainMenu
) {
  const kernelspecs = docmanager.services.kernelspecs.specs.kernelspecs;
  // use "first" kernelspec
  const kernelSpec = Object.values(kernelspecs).pop();
  // use custom version info added to base images
  const version = kernelSpec.metadata.version;

  const versionLinkCommand = 'edc:goto-version';

  app.commands.addCommand(versionLinkCommand, {
    label: `Python libraries in the ${kernelSpec.display_name} Kernel`,
    iconClass: NOTEBOOK_ICON_CLASS,
    execute: () => {
      window.open(
        `https://github.com/eurodatacube/base-images/releases/tag/user-${version}`
      );
    }
  });

  // 21 is right below the official kernel info, which is 20
  mainMenu.helpMenu.addGroup([{ command: versionLinkCommand }], 21);
}
