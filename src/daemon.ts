import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { TttClient } from "./api.js";
import {
  ensureConfigDir,
  getDaemonSocketPath,
  getDaemonPidPath,
  getDaemonVersionPath,
} from "./config.js";
import type { IpcRequest, IpcResponse } from "./types.js";

// Load version from package.json
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);
const VERSION: string = packageJson.version;

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const startedAt = Date.now();
let lastActivity = Date.now();
let client: TttClient;
let server: net.Server;

function resetIdleTimer(): void {
  lastActivity = Date.now();
}

function setupIdleTimer(): void {
  const timer = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      shutdown();
    }
  }, 60_000);
  timer.unref();
}

function shutdown(): void {
  const socketPath = getDaemonSocketPath();
  const pidPath = getDaemonPidPath();
  const versionPath = getDaemonVersionPath();

  if (server) {
    server.close();
  }
  if (client) {
    client.disconnect().catch(() => {});
  }
  try {
    fs.unlinkSync(socketPath);
  } catch {}
  try {
    fs.unlinkSync(pidPath);
  } catch {}
  try {
    fs.unlinkSync(versionPath);
  } catch {}
  process.exit(0);
}

async function handleRequest(req: IpcRequest): Promise<IpcResponse> {
  resetIdleTimer();
  try {
    let result: unknown;
    switch (req.method) {
      case "ping":
        result = {
          pid: process.pid,
          uptime: Math.floor((Date.now() - startedAt) / 1000),
          version: VERSION,
        };
        break;
      case "shutdown":
        // Respond before exiting
        setTimeout(() => shutdown(), 100);
        result = { ok: true };
        break;
      case "getLists":
        result = await client.getLists();
        break;
      case "getTodos":
        result = await client.getTodos(req.args[0] as string | undefined);
        break;
      case "findListByNameOrId":
        result = await client.findListByNameOrId(req.args[0] as string);
        break;
      case "createList":
        result = await client.createList(
          req.args[0] as string,
          (req.args[1] as any) || {}
        );
        break;
      case "updateList":
        result = await client.updateList(
          req.args[0] as string,
          req.args[1] as any
        );
        break;
      case "deleteList":
        result = await client.deleteList(req.args[0] as string);
        break;
      case "restoreList":
        result = await client.restoreList(req.args[0] as any);
        break;
      case "addTodo":
        result = await client.addTodo(
          req.args[0] as string,
          req.args[1] as string,
          (req.args[2] as any) || {}
        );
        break;
      case "markTodoDone":
        result = await client.markTodoDone(req.args[0] as string);
        break;
      case "deleteTodo":
        result = await client.deleteTodo(req.args[0] as string);
        break;
      case "updateTodo":
        result = await client.updateTodo(
          req.args[0] as string,
          req.args[1] as any
        );
        break;
      case "markTodoUndone":
        result = await client.markTodoUndone(req.args[0] as string);
        break;
      case "batchAddTodos":
        result = await client.batchAddTodos(
          req.args[0] as string,
          req.args[1] as any
        );
        break;
      case "batchUpdateTodos":
        result = await client.batchUpdateTodos(req.args[0] as any);
        break;
      case "batchDeleteTodos":
        result = await client.batchDeleteTodos(req.args[0] as string[]);
        break;
      case "restoreTodo":
        result = await client.restoreTodo(req.args[0] as any);
        break;
      default:
        return { id: req.id, error: `Unknown method: ${req.method}` };
    }
    return { id: req.id, result };
  } catch (err: any) {
    return { id: req.id, error: err.message || String(err) };
  }
}

function handleConnection(socket: net.Socket): void {
  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (!line.trim()) continue;

      let req: IpcRequest;
      try {
        req = JSON.parse(line);
      } catch {
        socket.write(
          JSON.stringify({ id: "unknown", error: "Invalid JSON" }) + "\n"
        );
        continue;
      }

      handleRequest(req).then((res) => {
        if (!socket.destroyed) {
          socket.write(JSON.stringify(res) + "\n");
        }
      });
    }
  });

  socket.on("error", () => {
    // Client disconnected unexpectedly — ignore
  });
}

async function main(): Promise<void> {
  ensureConfigDir();
  const socketPath = getDaemonSocketPath();
  const pidPath = getDaemonPidPath();
  const versionPath = getDaemonVersionPath();

  // Clean up stale socket file
  try {
    fs.unlinkSync(socketPath);
  } catch {}

  // Connect TttClient
  client = new TttClient();
  await client.connect();

  // Start Unix socket server
  server = net.createServer(handleConnection);

  server.listen(socketPath, () => {
    // Write PID and version files
    fs.writeFileSync(pidPath, String(process.pid));
    fs.writeFileSync(versionPath, VERSION);

    // Signal parent that we're ready
    if (process.send) {
      process.send("ready");
    }
  });

  server.on("error", (err) => {
    console.error("Daemon server error:", err.message);
    shutdown();
  });

  setupIdleTimer();

  // Handle termination signals
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Daemon failed to start:", err.message);
  process.exit(1);
});
