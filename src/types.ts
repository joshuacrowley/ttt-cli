import type { List, Todo } from "./api.js";

export interface ITttClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getLists(): Promise<List[]>;
  getTodos(listId?: string): Promise<Todo[]>;
  findListByNameOrId(nameOrId: string): Promise<List | undefined>;
  createList(
    name: string,
    options?: { color?: string; type?: string; icon?: string }
  ): Promise<string>;
  addTodo(
    listId: string,
    text: string,
    fields?: Partial<Omit<Todo, "id" | "list" | "text" | "done">>
  ): Promise<string>;
  markTodoDone(todoId: string): Promise<void>;
}

export interface IpcRequest {
  id: string;
  method: string;
  args: unknown[];
}

export interface IpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}
