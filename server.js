const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const MAX_BODY = 1024 * 1024;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function readRequestBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleCompile(req, res) {
  try {
    const body = await readRequestBody(req);
    const payload = JSON.parse(body || "{}");
    const source = String(payload.source || "");
    if (!source.trim()) {
      sendJson(res, 400, { ok: false, log: "No LaTeX source was provided." });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      engine: "prototype-renderer",
      log: [
        "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (prototype)",
        "entering extended mode",
        "(./main.tex",
        "LaTeX2e <2024-11-01> patch level 2",
        "Document Class: article 2024/06/29 v1.4n Standard LaTeX document class",
        "[1]",
        "Output written on main.pdf (1 page, 42138 bytes).",
        "Transcript written on main.log.",
        "",
        "Prototype note: no local TeX engine was executed."
      ].join("\n")
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, log: error.message });
  }
}

async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const filePath = requested === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, requested);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(normalized);
    res.writeHead(200, { "content-type": contentType(normalized) });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/compile") {
    handleCompile(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use on ${HOST}.`);
    console.error(`Stop the existing server or run with another port, for example: PORT=3001 npm run dev`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Writing & Evaluation prototype running at http://${HOST}:${PORT}`);
});
