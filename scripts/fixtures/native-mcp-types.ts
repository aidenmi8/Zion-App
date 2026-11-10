import {
  createMcpServer,
  getCliToolDefinitions,
  startStdioServer,
  TOOLS,
} from "@hypothesi/tauri-mcp-server";

// Compile the supported package entrypoint, without invoking native tools.
const server = createMcpServer({
  name: "synthetic-type-consumer",
  version: "1",
});
const connect: typeof server.connect = server.connect;
const definitions: Record<string, unknown>[] = getCliToolDefinitions().map(
  (tool) => tool.inputSchema,
);
const run: (info: { name: string; version: string }) => Promise<void> =
  startStdioServer;
const parsed: unknown = TOOLS[0].schema.parse({});
void [connect, definitions, run, parsed];
