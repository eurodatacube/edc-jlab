import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {},
  apiNamespace = 'edc_jlab'
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const parsedBaseUrl = URLExt.parse(settings.baseUrl);
  // if apiNamespace is an absolut path, build url without prefix in settings
  const actualBaseUrl =
    apiNamespace[0] === '/'
      ? `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}/`
      : settings.baseUrl;
  const requestUrl = URLExt.join(actualBaseUrl, apiNamespace, endPoint);

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.log('Not a JSON response body.', response);
    }
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}
