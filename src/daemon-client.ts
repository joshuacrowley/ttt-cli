import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import {
  ensureConfigDir,
  getDaemonSocketPath,
  getDaemonPidPath,
} from "./config.js";
import type { ITttClient, IpcRequest, IpcResponse, BatchAddItem, BatchUpdateItem, BatchUpdateResult, ListFields, ListUpdateResult } from "./types.js";
import type { List, Todo } from "./api.js";

// Load version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);
const CLI_VERSION: string = packageJson.version;

const SPAWN_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class DaemonClient implements ITttClient {
  private socket: net.Socket | null = null;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private buffer = "";

  async connect(options?: { autoStart?: boolean }): Promise<void> {
    const socketPath = getDaemonSocketPath();
    const autoStart = options?.autoStart !== false;

    // Try to connect to existing daemon
    try {
      await this.connectToSocket(socketPath);
      
      // Check version compatibility
      const info = await this.ping();
      if (info.version && info.version !== CLI_VERSION) {
        // Version mismatch - restart daemon
        await this.shutdown();
        await this.disconnect();
        
        // Small delay to allow cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        await this.spawnDaemon();
        await this.connectToSocket(socketPath);
      }
      return;
    } catch {
      if (!autoStart) throw new Error("Daemon is not running");
    }

    await this.spawnDaemon();
    await this.connectToSocket(socketPath);
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async getLists(): Promise<List[]> {
    return (await this.call("getLists", [])) as List[];
  }

  async getTodos(listId?: string): Promise<Todo[]> {
    return (await this.call("getTodos", [listId])) as Todo[];
  }

  async findListByNameOrId(nameOrId: string): Promise<List | undefined> {
    return (await this.call("findListByNameOrId", [nameOrId])) as
      | List
      | undefined;
  }

  async createList(
    name: string,
    options?: { color?: string; type?: string; icon?: string }
  ): Promise<string> {
    return (await this.call("createList", [name, options || {}])) as string;
  }

  async updateList(listId: string, fields: ListFields): Promise<ListUpdateResult> {
    return (await this.call("updateList", [listId, fields])) as ListUpdateResult;
  }

  async deleteList(listId: string): Promise<List> {
    return (await this.call("deleteList", [listId])) as List;
  }

  async restoreList(list: List): Promise<void> {
    await this.call("restoreList", [list]);
  }

  async addTodo(
    listId: string,
    text: string,
    fields?: Partial<Omit<Todo, "id" | "list" | "text" | "done">>
  ): Promise<string> {
    return (await this.call("addTodo", [listId, text, fields || {}])) as string;
  }

  async markTodoDone(todoId: string): Promise<Todo> {
    return (await this.call("markTodoDone", [todoId])) as Todo;
  }

  async deleteTodo(todoId: string): Promise<Todo> {
    return (await this.call("deleteTodo", [todoId])) as Todo;
  }

  async updateTodo(todoId: string, fields: Partial<Omit<Todo, "id" | "list">>): Promise<BatchUpdateResult> {
    return (await this.call("updateTodo", [todoId, fields])) as BatchUpdateResult;
  }

  async markTodoUndone(todoId: string): Promise<Todo> {
    return (await this.call("markTodoUndone", [todoId])) as Todo;
  }

  async batchAddTodos(listId: string, items: BatchAddItem[]): Promise<string[]> {
    return (await this.call("batchAddTodos", [listId, items])) as string[];
  }

  async batchUpdateTodos(updates: BatchUpdateItem[]): Promise<BatchUpdateResult[]> {
    return (await this.call("batchUpdateTodos", [updates])) as BatchUpdateResult[];
  }

  async batchDeleteTodos(todoIds: string[]): Promise<void> {
    await this.call("batchDeleteTodos", [todoIds]);
  }

  async restoreTodo(todo: Todo): Promise<void> {
    await this.call("restoreTodo", [todo]);
  }

  async ping(): Promise<{ pid: number; uptime: number; version?: string }> {
    return (await this.call("ping", [])) as { pid: number; uptime: number; version?: string };
  }

  async shutdown(): Promise<void> {
    try {
      await this.call("shutdown", []);
    } catch {
      // Daemon may close connection before we get a response
    }
  }

  private connectToSocket(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Socket connect timeout"));
      }, 3000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.buffer = "";
        this.setupSocketHandlers();
        resolve();
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on("data", (data) => {
      this.buffer += data.toString();
      let newlineIdx: number;
      while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newlineIdx);
        this.buffer = this.buffer.slice(newlineIdx + 1);
        if (!line.trim()) continue;

        try {
          const res: IpcResponse = JSON.parse(line);
          const p = this.pending.get(res.id);
          if (p) {
            this.pending.delete(res.id);
            if (res.error) {
              p.reject(new Error(res.error));
            } else {
              p.resolve(res.result);
            }
          }
        } catch {
          // Ignore malformed responses
        }
      }
    });

    this.socket.on("close", () => {
      for (const p of this.pending.values()) {
        p.reject(new Error("Daemon connection closed"));
      }
      this.pending.clear();
      this.socket = null;
    });

    this.socket.on("error", () => {
      // handled by close
    });
  }

  private call(method: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error("Not connected to daemon"));
        return;
      }

      const id = crypto.randomUUID();
      const req: IpcRequest = { id, method, args };

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.socket.write(JSON.stringify(req) + "\n");
    });
  }

  private spawnDaemon(): Promise<void> {
    ensureConfigDir();

    // Resolve the daemon script path relative to this file's compiled location
    const daemonScript = path.join(__dirname, "daemon.js");

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [daemonScript], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });

      const timeout = setTimeout(() => {
        child.removeAllListeners();
        child.unref();
        reject(new Error("Daemon spawn timeout"));
      }, SPAWN_TIMEOUT_MS);

      child.on("message", (msg) => {
        if (msg === "ready") {
          clearTimeout(timeout);
          child.disconnect();
          child.unref();
          resolve();
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn daemon: ${err.message}`));
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Daemon exited during startup with code ${code}`));
      });
    });
  }
}
