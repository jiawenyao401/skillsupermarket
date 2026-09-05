/**
 * Dynamic metadata routes can outlive the stream returned by ImageResponse
 * when the framework pipes it through its route cache. Materialize the small
 * PNG first so the route boundary receives a complete, length-delimited body.
 */
export async function bufferPngResponse(response: Response): Promise<Response> {
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set("content-type", "image/png");
  headers.set("content-length", String(body.byteLength));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
