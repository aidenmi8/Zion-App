import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { TOOLS } from "@hypothesi/tauri-mcp-server";

const contract = JSON.parse(
  readFileSync(new URL("./fixtures/native-mcp-contract.json", import.meta.url)),
);
let child;
let rpc;
beforeAll(async () => {
  const entry = fileURLToPath(
    new URL(
      "../node_modules/@hypothesi/tauri-mcp-server/dist/index.js",
      import.meta.url,
    ),
  );
  child = spawn(process.execPath, ["--max-old-space-size=128", entry], {
    env: { PATH: process.env.PATH, LC_ALL: "C.UTF-8" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let id = 0;
  const pending = new Map();
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    pending.get(message.id)?.(message);
  });
  child.on("exit", (code) => {
    for (const done of pending.values())
      done({ error: { message: "child exited " + code + ": " + errors } });
  });
  rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timeout = setTimeout(() => {
        pending.delete(key);
        reject(new Error(method + " timed out: " + errors));
      }, 10_000);
      pending.set(key, (message) => {
        clearTimeout(timeout);
        pending.delete(key);
        resolve(message);
      });
      child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id: key, method, params }) + "\n",
      );
    });
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "synthetic-native-compatibility", version: "1" },
  });
  assert.equal(init.error, undefined);
  assert.equal(init.result.protocolVersion, "2024-11-05");
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
});
afterAll(() => {
  child?.stdin.end();
  child?.kill("SIGTERM");
});

test("native tooling retains all advertised tools, prompts and input defaults", async () => {
  const list = await rpc("tools/list", {});
  expect(list.error).toBeUndefined();
  expect(list.result.tools.map((tool) => tool.name)).toEqual(
    contract.tools.map((tool) => tool.name),
  );
  for (const [index, tool] of list.result.tools.entries()) {
    const previous = contract.tools[index];
    expect(tool.description).toBe(previous.description);
    expect(tool.annotations).toEqual(previous.annotations);
    // Zod 4's intrinsic safe-integer bounds may be additional. Declared fields,
    // requiredness, defaults, limits and unknown-key policy remain intact.
    expect(tool.inputSchema).toMatchObject(previous.inputSchema);
    expect(Object.keys(tool.inputSchema.properties)).toEqual(
      Object.keys(previous.inputSchema.properties),
    );
  }
  const prompts = await rpc("prompts/list", {});
  expect(prompts.result.prompts).toEqual(contract.prompts);
  const prompt = await rpc("prompts/get", {
    name: "select",
    arguments: { message: "synthetic context" },
  });
  expect(prompt.result.messages[0].content.text).toContain("synthetic context");
  const setup = await rpc("tools/call", { name: "get_setup_instructions" });
  expect(setup.result.isError).not.toBe(true);
  expect(setup.result.content[0].type).toBe("text");
  const unknown = await rpc("tools/call", {
    name: "not_a_tool",
    arguments: {},
  });
  expect(unknown.result).toMatchObject({ isError: true });
  expect(unknown.result.content[0].text).toContain("Unknown tool: not_a_tool");
});

test.each([
  [
    "webview_keyboard",
    { action: "press", modifiers: Array(1000).fill("invalid") },
  ],
  [
    "webview_find_element",
    { selector: "body", properties: Array(1000).fill(42) },
  ],
])(
  "invalid collections do not amplify native MCP errors: %s",
  async (name, args) => {
    const response = await rpc("tools/call", { name, arguments: args });
    expect(response.error).toBeUndefined();
    expect(response.result.isError).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(response.result))).toBeLessThan(
      4096,
    );
    const healthy = await rpc("tools/list", {});
    expect(healthy.result.tools).toHaveLength(19);
  },
);

test("native schema parsing preserves omitted fields, defaults and key stripping", () => {
  const schema = (name) => TOOLS.find((tool) => tool.name === name).schema;
  expect(
    schema("webview_find_element").parse({ selector: "body", extra: true }),
  ).toEqual({
    selector: "body",
    strategy: "css",
    limit: 5,
    visibleOnly: true,
    includeHtml: false,
  });
  expect(schema("webview_screenshot").parse({})).toEqual({
    format: "jpeg",
    quality: 80,
    allowScreenCapture: false,
  });
  expect(
    schema("webview_wait_for").parse({ type: "selector", value: "body" }),
  ).toEqual({
    type: "selector",
    value: "body",
    strategy: "css",
    timeout: 5000,
  });
  expect(
    schema("ipc_emit_event").parse({ eventName: "synthetic", extra: true }),
  ).toEqual({
    eventName: "synthetic",
  });
  expect(
    schema("webview_keyboard").parse({
      action: "press",
      modifiers: ["Control", "Shift"],
    }),
  ).toEqual({
    action: "press",
    strategy: "css",
    modifiers: ["Control", "Shift"],
  });
  expect(() =>
    schema("webview_keyboard").parse({
      action: "press",
      modifiers: ["invalid"],
    }),
  ).toThrow();
});

test("the supported native-tool type entrypoint remains usable", () => {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/typescript/bin/tsc", import.meta.url),
      ),
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "false",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      fileURLToPath(new URL("./fixtures/native-mcp-types.ts", import.meta.url)),
    ],
    { timeout: 20_000, stdio: "pipe", env: { PATH: process.env.PATH } },
  );
});

test("native IPC dispatch keeps omitted payloads and bridge failures intact", async () => {
  const bridge = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve, reject) => {
    bridge.once("listening", resolve);
    bridge.once("error", reject);
  });
  const events = [];
  bridge.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const { id, command, args } = JSON.parse(raw);
      const inner = args?.command;
      if (inner === "plugin:mcp-bridge|emit_event") {
        events.push(args.args);
        socket.send(
          JSON.stringify({
            id,
            success: args.args.eventName !== "refused",
            ...(args.args.eventName === "refused"
              ? { error: "synthetic bridge refusal" }
              : { data: { delivered: true } }),
          }),
        );
        return;
      }
      expect(
        command === "get_backend_state" ||
          inner === "plugin:mcp-bridge|get_backend_state",
      ).toBe(true);
      socket.send(
        JSON.stringify({
          id,
          success: true,
          data: {
            app: {
              name: "Synthetic test app",
              identifier: "example.native-test",
            },
            environment: { debug: true },
            windows: [{ label: "main" }],
            bridge: { pluginVersion: "0.13.1" },
          },
        }),
      );
    });
  });
  try {
    const start = await rpc("tools/call", {
      name: "driver_session",
      arguments: {
        action: "start",
        host: "127.0.0.1",
        port: bridge.address().port,
      },
    });
    expect(start.result.isError).not.toBe(true);
    expect(start.result.content[0].text).toContain("Session started");
    const sent = await rpc("tools/call", {
      name: "ipc_emit_event",
      arguments: { eventName: "synthetic-event" },
    });
    expect(sent.result.isError).not.toBe(true);
    expect(JSON.parse(sent.result.content[0].text)).toEqual({
      delivered: true,
    });
    const refused = await rpc("tools/call", {
      name: "ipc_emit_event",
      arguments: { eventName: "refused", payload: null },
    });
    expect(refused.result.isError).toBe(true);
    expect(refused.result.content[0].text).toContain(
      "synthetic bridge refusal",
    );
    expect(events).toEqual([
      { eventName: "synthetic-event" },
      { eventName: "refused", payload: null },
    ]);
  } finally {
    await rpc("tools/call", {
      name: "driver_session",
      arguments: { action: "stop" },
    });
    for (const socket of bridge.clients) socket.terminate();
    await new Promise((resolve) => bridge.close(resolve));
  }
});
