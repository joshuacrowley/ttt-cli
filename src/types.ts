import type { List, Todo } from "./api.js";

export type TodoFields = Partial<Omit<Todo, "id" | "list" | "text" | "done">>;

export interface BatchAddItem {
  text: string;
  fields?: TodoFields;
}

export interface BatchUpdateItem {
  id: string;
  fields: Partial<Omit<Todo, "id" | "list">>;
}

export interface BatchUpdateResult {
  id: string;
  previousFields: Partial<Todo>;
}

export type ListFields = Partial<Omit<List, "id">>;

export interface ListUpdateResult {
  id: string;
  previousFields: Partial<List>;
}

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
  updateList(listId: string, fields: ListFields): Promise<ListUpdateResult>;
  deleteList(listId: string): Promise<List>;  // Returns deleted list for undo
  restoreList(list: List): Promise<void>;
  addTodo(
    listId: string,
    text: string,
    fields?: TodoFields
  ): Promise<string>;
  updateTodo(todoId: string, fields: Partial<Omit<Todo, "id" | "list">>): Promise<BatchUpdateResult>;
  markTodoDone(todoId: string): Promise<Todo>;  // Returns previous state for undo
  markTodoUndone(todoId: string): Promise<Todo>;  // Returns previous state for undo
  deleteTodo(todoId: string): Promise<Todo>;  // Returns deleted todo for undo
  batchAddTodos(listId: string, items: BatchAddItem[]): Promise<string[]>;
  batchUpdateTodos(updates: BatchUpdateItem[]): Promise<BatchUpdateResult[]>;
  batchDeleteTodos(todoIds: string[]): Promise<void>;
  restoreTodo(todo: Todo): Promise<void>;
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
