import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const defaultPort = Number(process.env.PORT || 8080);

const types = {
  ".css": "text/css",
  ".buf": "application/octet-stream",
  ".exr": "application/octet-stream",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

export function createStaticServer() {
  return createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/" || url.pathname === "/about/about" || url.pathname === "/about/about/") {
      res.writeHead(302, { location: "/about/" });
      res.end();
      return;
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
    let file = join(root, path);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    const info = await stat(file);
    if (!info.isFile() || relative(root, file).startsWith("..")) throw new Error("not found");
    const extension = extname(file).toLowerCase();
    const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_astro/");
    const headers = {
      "accept-ranges": "bytes",
      "cache-control": isAsset ? "public, max-age=86400" : "no-cache",
      "content-type": types[extension] || "application/octet-stream",
    };
    let start = 0;
    let end = info.size - 1;
    let statusCode = 200;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { ...headers, "content-range": `bytes */${info.size}` });
        res.end();
        return;
      }
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), info.size - 1) : end;
      } else {
        const suffixLength = Math.min(Number(match[2]), info.size);
        start = info.size - suffixLength;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size) {
        res.writeHead(416, { ...headers, "content-range": `bytes */${info.size}` });
        res.end();
        return;
      }
      statusCode = 206;
      headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
    }
    headers["content-length"] = String(end - start + 1);
    res.writeHead(statusCode, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file, { start, end }).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
  });
}

export function startServer(port = defaultPort) {
  const server = createStaticServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      console.log(`http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
