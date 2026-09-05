import assert from "node:assert/strict";
import test from "node:test";
import { bufferPngResponse } from "../lib/og-image";

test("dynamic OG images cross the route boundary as a complete PNG response", async () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const source = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(png.subarray(0, 5));
      controller.enqueue(png.subarray(5));
      controller.close();
    },
  }), { headers: { "content-type": "image/png", "x-og-source": "image-response" } });

  const response = await bufferPngResponse(source);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), String(png.byteLength));
  assert.equal(response.headers.get("x-og-source"), "image-response");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
});
