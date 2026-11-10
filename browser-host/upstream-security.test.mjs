import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, test } from "vitest";

// A failed library response must reject one request, not terminate the broker.
// Isolate the real upstream client because the vulnerable version crashes Node.
const client = new URL("./relay-broker.mjs", import.meta.url).href;
let certificates;
beforeAll(() => {
  certificates = mkdtempSync(
    join(process.env.BUZZ_SECURITY_TEST_ROOT ?? tmpdir(), "upstream-tls-"),
  );
  for (const [name, address] of [
    ["matching", "127.0.0.1"],
    ["wrong", "192.0.2.1"],
  ]) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:prime256v1",
        "-nodes",
        "-days",
        "2",
        "-subj",
        `/CN=${address}`,
        "-addext",
        `subjectAltName=IP:${address}`,
        "-keyout",
        join(certificates, `${name}.key`),
        "-out",
        join(certificates, `${name}.pem`),
      ],
      { stdio: "pipe" },
    );
  }
  // Only the disposable child trusts these newly generated test certificates.
  writeFileSync(
    join(certificates, "ca.pem"),
    ["matching", "wrong"]
      .map((name) => readFileSync(join(certificates, `${name}.pem`), "utf8"))
      .join("\n"),
  );
});
afterAll(() => {
  if (certificates) rmSync(certificates, { recursive: true, force: true });
});

const worker = `
  import assert from "node:assert/strict";
  import { createServer } from "node:http";
  import { gzipSync } from "node:zlib";
  import { createUpstream } from ${JSON.stringify(client)};

  const server = createServer((request, response) => {
    if (request.url === "/malformed") {
      response.writeHead(200, {
        "content-encoding": process.argv[1],
        "content-length": "1",
      });
      response.flushHeaders();
      response.socket.end();
      return;
    }
    assert.equal(request.headers.authorization, "Nostr synthetic-test");
    const body = gzipSync("healthy after rejected response");
    response.writeHead(200, { "content-encoding": "gzip" });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const upstream = createUpstream(base);
  try {
    await assert.rejects(upstream.fetch(base + "/malformed"));
    const response = await upstream.fetch(base + "/healthy", {
      headers: { authorization: "Nostr synthetic-test" },
    });
    assert.equal(await response.text(), "healthy after rejected response");
    console.log("rejected-and-recovered");
  } finally {
    await upstream.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
`;

test.each([
  "gzip,gzip,gzip,gzip,gzip,gzip",
  "GZIP, br, deflate, identity, gzip, br, gzip",
])("the upstream client contains an invalid encoding chain: %s", (encoding) => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--input-type=module",
      "-e",
      worker,
      encoding,
    ],
    {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      env: { PATH: process.env.PATH, LC_ALL: "C.UTF-8" },
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rejected-and-recovered/);
});

test("the upstream client rejects a renegotiated certificate and stays usable", () => {
  const source = String.raw`
    import assert from "node:assert/strict";
    import { constants } from "node:crypto";
    import { readFileSync } from "node:fs";
    import { join } from "node:path";
    import { createServer } from "node:tls";
    import { createUpstream } from ${JSON.stringify(client)};

    const credentials = (name) => ({
      key: readFileSync(join(process.argv[1], name + ".key")),
      cert: readFileSync(join(process.argv[1], name + ".pem")),
    });
    const sockets = new Set();
    let renegotiated = false;
    const server = createServer({
      ...credentials("matching"),
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
      secureOptions: constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION,
      ALPNProtocols: ["http/1.1"],
    }, (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {});
      socket.once("data", (request) => {
        if (request.toString().includes("GET /healthy ")) {
          socket.end("HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nhealthy");
          return;
        }
        socket.setKeyCert(credentials("wrong"));
        renegotiated = socket.renegotiate({ requestCert: false }, () => {});
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "https://127.0.0.1:" + server.address().port;
    const upstream = createUpstream(base);
    try {
      await assert.rejects(upstream.fetch(base + "/renegotiate"), (error) => {
        assert.equal(error.cause?.code, "ERR_TLS_CERT_ALTNAME_INVALID");
        return true;
      });
      assert.equal(renegotiated, true);
      const response = await upstream.fetch(base + "/healthy");
      assert.equal(await response.text(), "healthy");
      console.log("renegotiation-contained");
    } finally {
      for (const socket of sockets) socket.destroy();
      await upstream.close();
      await new Promise((resolve) => server.close(resolve));
    }
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--input-type=module",
      "-e",
      source,
      certificates,
    ],
    {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      env: {
        PATH: process.env.PATH,
        NODE_EXTRA_CA_CERTS: join(certificates, "ca.pem"),
        LC_ALL: "C.UTF-8",
      },
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /renegotiation-contained/);
});
