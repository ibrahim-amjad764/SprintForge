/*
 * API Helper
 *
 * Purpose:
 * - Central place for frontend API calls.
 * - Handles JSON and multipart/form-data requests.
 * - Provides consistent error handling.
 * - Automatically parses API responses.
 * - Keeps authentication credentials included.
 *
 * Important:
 * - DO NOT manually set Content-Type for FormData.
 * - Browser automatically generates:
 *   multipart/form-data; boundary=...
 *
 * This is required for file uploads.
 */

export async function apiRequest(url: string, options: RequestInit = {}) {
  try {
    /*
     * --------------------------------------------------------
     * Detect request body type
     * --------------------------------------------------------
     *
     * FormData is used for:
     * - Images
     * - Files
     * - Documents
     * - Any multipart upload
     *
     * JSON is used for:
     * - Workspace updates
     * - Tasks
     * - Projects
     * - Members
     * - Settings
     */
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    /*
     * --------------------------------------------------------
     * Build headers safely
     * --------------------------------------------------------
     *
     * IMPORTANT:
     * Never set Content-Type manually for FormData.
     *
     * Browser needs to add the multipart boundary:
     *
     * multipart/form-data; boundary=----WebKitFormBoundary...
     *
     * If we manually set:
     *
     * Content-Type: application/json
     *
     * the upload route will fail.
     */
    const headers = new Headers(options.headers);

    if (!isFormData) {
      /*
       * JSON API request.
       *
       * Only set JSON Content-Type when request is
       * NOT a multipart/form-data request.
       */
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    } else {
      /*
       * FormData request.
       *
       * Explicitly remove Content-Type so that fetch/browser
       * can automatically generate the correct multipart boundary.
       */
      headers.delete('Content-Type');
    }

    /*
     * --------------------------------------------------------
     * Execute request
     * --------------------------------------------------------
     */
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    /*
     * --------------------------------------------------------
     * Safely parse response
     * --------------------------------------------------------
     *
     * Some APIs may return:
     * - JSON
     * - Empty response
     * - Plain text
     *
     * We don't want response.json() itself to throw another
     * confusing error.
     */
    const contentType = response.headers.get('content-type') || '';

    let data: any = null;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', {
          url,
          status: response.status,
          parseError,
        });

        data = null;
      }
    } else {
      /*
       * Handle non-JSON responses gracefully.
       */
      try {
        const text = await response.text();

        data = text
          ? {
              message: text,
            }
          : null;
      } catch (textError) {
        console.error('Failed to read API response:', {
          url,
          status: response.status,
          textError,
        });

        data = null;
      }
    }

    /*
     * --------------------------------------------------------
     * Handle HTTP errors
     * --------------------------------------------------------
     */
    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;

      console.error('API Request Failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        message,
        response: data,
      });

      throw new Error(message);
    }

    /*
     * --------------------------------------------------------
     * Successful request
     * --------------------------------------------------------
     */
    console.log('API Request Successful:', {
      url,
      method: options.method || 'GET',
      status: response.status,
      isFormData,
    });

    return data;
  } catch (error) {
    /*
     * --------------------------------------------------------
     * Centralized error logging
     * --------------------------------------------------------
     */
    console.error('apiRequest Error:', {
      url,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }
}
