import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

// Exercise the default client, not the fetch injection used by unit fixtures.
// A vulnerable embedded fetch can terminate Node after login catches its error.
const owner = new URL("./builderlab.mjs", import.meta.url).href;
const worker = String.raw`
  import assert from "node:assert/strict";
  import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
  import { createServer } from "node:http";
  import { homedir } from "node:os";
  import { join } from "node:path";
  import { gzipSync } from "node:zlib";
  import { createBuilderlab } from ${JSON.stringify(owner)};

  const encoding = process.argv[1];
  const expiry = new Date(Date.now() + 60_000).toISOString();
  let refused = false;
  let uploads = 0;
  const server = createServer(async (request, response) => {
    if (request.url === "/v1/auth/login/exchange") {
      if (encoding && !refused) {
        refused = true;
        response.writeHead(200, {
          "content-encoding": encoding,
          "content-length": "1",
        });
        response.flushHeaders();
        response.socket.end();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        session_credential: "synthetic-session", expires_at: expiry,
      }));
      return;
    }
    if (request.url === "/v1/auth/me") {
      assert.equal(request.headers["x-bb-session-credential"], "synthetic-session");
      response.end(JSON.stringify({ subject: "synthetic-owner", expires_at: expiry }));
      return;
    }
    if (request.url === "/v1/agent/apps/demo/deploy") {
      assert.equal(request.headers.authorization, "BBIdentity synthetic-session");
      assert.match(request.headers["content-type"], /^multipart\/form-data; boundary=/);
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      assert.match(body, /name="artifact"; filename="artifact.tar.gz"/);
      assert.match(body, /synthetic archive bytes/);
      uploads += 1;
      response.end(JSON.stringify({ deployment_id: "synthetic-deployment" }));
      return;
    }
    assert.equal(request.headers["x-bb-session-credential"], "synthetic-session");
    if (request.url === "/v1/buzz/communities/list") {
      assert.equal(request.headers.origin, api);
      response.setHeader("content-encoding", "gzip");
      response.end(gzipSync(JSON.stringify({ communities: [] })));
      return;
    }
    // A synthetic binding refusal avoids creating or claiming any identity.
    response.end(JSON.stringify({ error: { code: "synthetic-refusal" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const api = "http://127.0.0.1:" + server.address().port;
  const key = new Uint8Array(32);
  key[31] = 1;
  const broker = createBuilderlab({
    api, appsBase: api, key: () => key,
    open: async (login) => {
      const link = new URL(login);
      const callback = new URL(link.searchParams.get("redirect_uri"));
      callback.searchParams.set("state", link.searchParams.get("state"));
      callback.searchParams.set("code", "synthetic-code");
      const response = await globalThis.fetch(callback);
      assert.equal(response.status, 200);
    },
  });
  let directory;
  try {
    if (encoding) {
      await assert.rejects(broker.login(AbortSignal.timeout(5000)));
      assert.equal(broker.snapshot().auth, null);
      assert.equal(broker.snapshot().pending, false);
    }
    const account = await broker.login(AbortSignal.timeout(5000));
    assert.equal(account.subject, "synthetic-owner");
    assert.deepEqual(await broker.call("list", {}), { communities: [] });
    if (!encoding) {
      // Match the owner's home-only artifact boundary without using app data.
      directory = mkdtempSync(join(realpathSync(homedir()), ".buzz-upload-test-"));
      const file = join(directory, "artifact.tar.gz");
      writeFileSync(file, "synthetic archive bytes");
      const receipt = await broker.request({
        revision: broker.snapshot().revision, target: "apps",
        path: "/v1/agent/apps/demo/deploy", method: "POST", file,
      }, AbortSignal.timeout(5000));
      assert.equal(JSON.parse(receipt.body).deployment_id, "synthetic-deployment");
      assert.equal(uploads, 1);
    }
    await broker.auth();
    broker.signOut();
    assert.equal(broker.snapshot().auth, null);
    console.log("builderlab-contained-and-recovered");
  } finally {
    broker.signOut();
    if (directory) rmSync(directory, { recursive: true, force: true });
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
`;

test.each([
  "gzip,gzip,gzip,gzip,gzip,gzip",
  "GZIP, br, deflate, identity, gzip, br, gzip",
])("default Builderlab login survives an invalid encoding chain: %s", run);

test("the default Builderlab client preserves native multipart uploads", () => {
  run("");
});

function run(encoding) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", worker, encoding],
    {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 64 * 1024,
      env: { PATH: process.env.PATH, LC_ALL: "C.UTF-8" },
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /builderlab-contained-and-recovered/);
}
