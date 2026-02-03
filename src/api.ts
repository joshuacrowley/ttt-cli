import { createMergeableStore, type MergeableStore } from "tinybase";
import { createWsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client";
import WebSocket from "ws";
import { loadConfig } from "./config.js";
import type { ITttClient, BatchAddItem, BatchUpdateItem, BatchUpdateResult, ListFields, ListUpdateResult } from "./types.js";

const SERVER = "wss://worker.tinytalkingtodos.com";
const SERVER_PATH = "/sync";

export interface List {
  id: string;
  name: string;
  purpose?: string;
  systemPrompt?: string;
  backgroundColour?: string;
  icon?: string;
  type?: string;
  template?: string;
}

export interface Todo {
  id: string;
  list: string;
  text: string;
  notes?: string;
  date?: string;
  time?: string;
  url?: string;
  emoji?: string;
  email?: string;
  streetAddress?: string;
  number?: number;
  amount?: number;
  fiveStarRating?: number;
  done?: boolean;
  type?: string;
  category?: string;
}

export class TttClient implements ITttClient {
  private store: MergeableStore;
  private synchronizer: any;
  private connected: boolean = false;

  constructor() {
    this.store = createMergeableStore();
  }

  async connect(): Promise<void> {
    const config = loadConfig();

    if (!config.sessionToken || !config.orgId) {
      throw new Error("Not logged in. Run 'ttt auth login' first.");
    }

    const serverPath = `${SERVER_PATH}/${config.orgId}`;
    const wsUrl = new URL(SERVER + serverPath);
    wsUrl.searchParams.set("token", config.sessionToken);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl.toString());

      ws.on("open", async () => {
        try {
          this.synchronizer = await createWsSynchronizer(this.store, ws as any, 1);
          await this.synchronizer.startSync();

          // Poll until data arrives (lists table populated) or timeout
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const tables = this.store.getTables();
            const lists = tables.lists || {};
            if (Object.keys(lists).length > 0) {
              // Give a brief moment for remaining data
              await new Promise((r) => setTimeout(r, 500));
              break;
            }
            await new Promise((r) => setTimeout(r, 200));
          }

          this.connected = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ws.on("error", (error) => {
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });

      // Set a connection timeout
      setTimeout(() => {
        if (!this.connected) {
          ws.close();
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.synchronizer) {
      await this.synchronizer.stopSync();
    }
    this.connected = false;
  }

  async getLists(): Promise<List[]> {
    const tables = this.store.getTables();
    const listsTable = tables.lists || {};

    return Object.entries(listsTable).map(([id, row]) => ({
      id,
      name: row.name as string || "",
      purpose: row.purpose as string,
      systemPrompt: row.systemPrompt as string,
      backgroundColour: row.backgroundColour as string,
      icon: row.icon as string,
      type: row.type as string,
      template: row.template as string,
    }));
  }

  async getTodos(listId?: string): Promise<Todo[]> {
    const tables = this.store.getTables();
    const todosTable = tables.todos || {};

    let todos = Object.entries(todosTable).map(([id, row]) => ({
      id,
      list: row.list as string || "",
      text: row.text as string || "",
      notes: row.notes as string,
      date: row.date as string,
      time: row.time as string,
      url: row.url as string,
      emoji: row.emoji as string,
      email: row.email as string,
      streetAddress: row.streetAddress as string,
      number: row.number as number,
      amount: row.amount as number,
      fiveStarRating: row.fiveStarRating as number,
      done: row.done as boolean,
      type: row.type as string,
      category: row.category as string,
    }));

    if (listId) {
      todos = todos.filter((todo) => todo.list === listId);
    }

    return todos;
  }

  async findListByNameOrId(nameOrId: string): Promise<List | undefined> {
    const lists = await this.getLists();
    return lists.find(
      (list) =>
        list.id === nameOrId ||
        list.name.toLowerCase() === nameOrId.toLowerCase()
    );
  }

  async createList(name: string, options: { color?: string; type?: string; icon?: string } = {}): Promise<string> {
    const id = `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.store.setRow("lists", id, {
      name,
      purpose: "",
      systemPrompt: "",
      backgroundColour: options.color || "blue",
      icon: options.icon || "",
      number: 0,
      template: "",
      code: "",
      type: options.type || "Info",
    });

    return id;
  }

  async updateList(listId: string, fields: ListFields): Promise<ListUpdateResult> {
    const row = this.store.getRow("lists", listId);
    if (!row) {
      throw new Error(`List not found: ${listId}`);
    }

    // Capture previous values for undo
    const previousFields: Partial<List> = {};
    for (const key of Object.keys(fields)) {
      previousFields[key as keyof List] = row[key] as any;
    }

    // Apply updates
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.store.setCell("lists", listId, key, value as any);
      }
    }

    return { id: listId, previousFields };
  }

  async deleteList(listId: string): Promise<List> {
    const row = this.store.getRow("lists", listId);
    if (!row) {
      throw new Error(`List not found: ${listId}`);
    }

    // Capture list data for undo before deleting
    const deletedList: List = {
      id: listId,
      name: row.name as string || "",
      purpose: row.purpose as string,
      systemPrompt: row.systemPrompt as string,
      backgroundColour: row.backgroundColour as string,
      icon: row.icon as string,
      type: row.type as string,
      template: row.template as string,
    };

    this.store.delRow("lists", listId);
    return deletedList;
  }

  async restoreList(list: List): Promise<void> {
    const { id, ...fields } = list;
    this.store.setRow("lists", id, {
      name: fields.name || "",
      purpose: fields.purpose || "",
      systemPrompt: fields.systemPrompt || "",
      backgroundColour: fields.backgroundColour || "blue",
      icon: fields.icon || "",
      number: 0,
      template: fields.template || "",
      code: "",
      type: fields.type || "Info",
    });
  }

  async addTodo(listId: string, text: string, fields: Partial<Omit<Todo, "id" | "list" | "text" | "done">> = {}): Promise<string> {
    const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.store.setRow("todos", id, {
      list: listId,
      text,
      notes: fields.notes || "",
      date: fields.date || "",
      time: fields.time || "",
      url: fields.url || "",
      emoji: fields.emoji || "",
      email: fields.email || "",
      streetAddress: fields.streetAddress || "",
      number: fields.number || 0,
      amount: fields.amount || 0,
      fiveStarRating: fields.fiveStarRating || 1,
      done: false,
      type: fields.type || "A",
      category: fields.category || "",
    });

    return id;
  }

  async markTodoDone(todoId: string): Promise<Todo> {
    const row = this.store.getRow("todos", todoId);
    if (!row) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    // Capture previous state for undo
    const previousTodo: Todo = {
      id: todoId,
      list: row.list as string || "",
      text: row.text as string || "",
      done: row.done as boolean,
      notes: row.notes as string,
      date: row.date as string,
      time: row.time as string,
      url: row.url as string,
      emoji: row.emoji as string,
      email: row.email as string,
      streetAddress: row.streetAddress as string,
      number: row.number as number,
      amount: row.amount as number,
      fiveStarRating: row.fiveStarRating as number,
      type: row.type as string,
      category: row.category as string,
    };

    this.store.setCell("todos", todoId, "done", true);
    return previousTodo;
  }

  async deleteTodo(todoId: string): Promise<Todo> {
    const row = this.store.getRow("todos", todoId);
    if (!row) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    // Capture todo data for undo before deleting
    const deletedTodo: Todo = {
      id: todoId,
      list: row.list as string || "",
      text: row.text as string || "",
      done: row.done as boolean,
      notes: row.notes as string,
      date: row.date as string,
      time: row.time as string,
      url: row.url as string,
      emoji: row.emoji as string,
      email: row.email as string,
      streetAddress: row.streetAddress as string,
      number: row.number as number,
      amount: row.amount as number,
      fiveStarRating: row.fiveStarRating as number,
      type: row.type as string,
      category: row.category as string,
    };

    this.store.delRow("todos", todoId);
    return deletedTodo;
  }

  async updateTodo(todoId: string, fields: Partial<Omit<Todo, "id" | "list">>): Promise<BatchUpdateResult> {
    const row = this.store.getRow("todos", todoId);
    if (!row) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    // Capture previous values for undo
    const previousFields: Partial<Todo> = {};
    for (const key of Object.keys(fields)) {
      previousFields[key as keyof Todo] = row[key] as any;
    }

    // Apply updates
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.store.setCell("todos", todoId, key, value as any);
      }
    }

    return { id: todoId, previousFields };
  }

  async markTodoUndone(todoId: string): Promise<Todo> {
    const row = this.store.getRow("todos", todoId);
    if (!row) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    // Capture previous state for undo
    const previousTodo: Todo = {
      id: todoId,
      list: row.list as string || "",
      text: row.text as string || "",
      done: row.done as boolean,
      notes: row.notes as string,
      date: row.date as string,
      time: row.time as string,
      url: row.url as string,
      emoji: row.emoji as string,
      email: row.email as string,
      streetAddress: row.streetAddress as string,
      number: row.number as number,
      amount: row.amount as number,
      fiveStarRating: row.fiveStarRating as number,
      type: row.type as string,
      category: row.category as string,
    };

    this.store.setCell("todos", todoId, "done", false);
    return previousTodo;
  }

  async batchAddTodos(listId: string, items: BatchAddItem[]): Promise<string[]> {
    const ids: string[] = [];

    this.store.transaction(() => {
      for (const item of items) {
        const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fields = item.fields || {};

        this.store.setRow("todos", id, {
          list: listId,
          text: item.text,
          notes: fields.notes || "",
          date: fields.date || "",
          time: fields.time || "",
          url: fields.url || "",
          emoji: fields.emoji || "",
          email: fields.email || "",
          streetAddress: fields.streetAddress || "",
          number: fields.number || 0,
          amount: fields.amount || 0,
          fiveStarRating: fields.fiveStarRating || 1,
          done: false,
          type: fields.type || "A",
          category: fields.category || "",
        });

        ids.push(id);
      }
    });

    return ids;
  }

  async batchUpdateTodos(updates: BatchUpdateItem[]): Promise<BatchUpdateResult[]> {
    const results: BatchUpdateResult[] = [];

    this.store.transaction(() => {
      for (const update of updates) {
        const row = this.store.getRow("todos", update.id);
        if (!row) continue;

        // Capture previous values for undo
        const previousFields: Partial<Todo> = {};
        for (const key of Object.keys(update.fields)) {
          previousFields[key as keyof Todo] = row[key] as any;
        }
        results.push({ id: update.id, previousFields });

        // Apply updates
        for (const [key, value] of Object.entries(update.fields)) {
          if (value !== undefined) {
            this.store.setCell("todos", update.id, key, value as any);
          }
        }
      }
    });

    return results;
  }

  async batchDeleteTodos(todoIds: string[]): Promise<void> {
    this.store.transaction(() => {
      for (const id of todoIds) {
        this.store.delRow("todos", id);
      }
    });
  }

  async restoreTodo(todo: Todo): Promise<void> {
    const { id, ...fields } = todo;
    this.store.setRow("todos", id, {
      list: fields.list || "",
      text: fields.text || "",
      notes: fields.notes || "",
      date: fields.date || "",
      time: fields.time || "",
      url: fields.url || "",
      emoji: fields.emoji || "",
      email: fields.email || "",
      streetAddress: fields.streetAddress || "",
      number: fields.number || 0,
      amount: fields.amount || 0,
      fiveStarRating: fields.fiveStarRating || 1,
      done: fields.done || false,
      type: fields.type || "A",
      category: fields.category || "",
    });
  }
}
