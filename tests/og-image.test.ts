import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import { getSharp } from "next/dist/server/image-optimizer";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
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

test("OG rendering survives image optimizer initialization in the same process", async () => {
  // Next.js 16.3.0 initialized a process-wide Sharp loader allowlist that
  // accidentally blocked internally generated SVGs (upstream #96681).
  // A cold OG-only check cannot detect this ordering-dependent regression.
  async function renderPng() {
    const response = await bufferPngResponse(new ImageResponse(
      createElement("div", { style: { display: "flex", width: "100%", height: "100%", background: "white" } }, "Public report"),
      { width: 120, height: 63 },
    ));
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 120);
    assert.equal(png.readUInt32BE(20), 63);
  }
  await renderPng();
  getSharp(undefined, undefined);
  await renderPng();
  await Promise.all(Array.from({ length: 3 }, renderPng));
  // Restoring the internal SVG renderer must not opt user-supplied SVGs in.
  assert.equal(imageConfigDefault.dangerouslyAllowSVG, false);
});
