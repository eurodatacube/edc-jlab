import {
  JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';


/**
 * Initialization data for the edc-jlab extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'edc-jlab',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension edc-jlab is activated!');
  }
};

export default extension;
