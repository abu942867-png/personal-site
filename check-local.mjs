import { startServer } from "./server.mjs";
import assert from "node:assert/strict";
import { Script } from "node:vm";

const server = await startServer(8099);

try {
  for (const path of ["/about/", "/recovered-static.css", "/recovered-static.js", "/_astro/about.CNa9RfUh.css"]) {
    const response = await fetch(`http://localhost:8099${path}`);
    console.log(path, response.status, response.headers.get("content-type"));

    if (path === "/about/") {
      const html = await response.text();
      assert.equal((html.match(/gzm-project-video[^>]+preload="none"/g) || []).length, 3);
      assert.match(html, /function pauseOthers\(current\)/);
      assert.match(html, /document\.addEventListener\("visibilitychange"/);
      const controller = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1])
        .find((script) => script.includes("var projectVideos"));
      assert.ok(controller, "video controller is present");
      new Script(controller);
      console.log("video controller syntax and lazy markup OK");
    }
  }

  const rangeResponse = await fetch("http://localhost:8099/assets/videos/aigc-farewell.mp4", {
    headers: { range: "bytes=0-1023" },
  });
  const rangeBody = await rangeResponse.arrayBuffer();
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeBody.byteLength, 1024);
  assert.equal(rangeResponse.headers.get("accept-ranges"), "bytes");
  assert.match(rangeResponse.headers.get("content-range") || "", /^bytes 0-1023\//);
  assert.match(rangeResponse.headers.get("cache-control") || "", /max-age/);
  console.log("video range and cache headers OK");
} finally {
  server.close();
}
