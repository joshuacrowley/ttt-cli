import * as fs from "fs";
import * as path from "path";
import { ensureConfigDir, getConfigDir } from "./config.js";
import type { List, Todo } from "./api.js";
import type { ITttClient, BatchUpdateResult, ListUpdateResult } from "./types.js";

const MAX_ENTRIES = 50;

export type UndoAction =
  | { type: "deleteTodo"; todoId: string }
  | { type: "batchDeleteTodos"; todoIds: string[] }
  | { type: "restoreTodo"; todo: Todo }
  | { type: "restoreFields"; updates: Array<{ id: string; fields: Partial<Todo> }> }
  | { type: "deleteList"; listId: string }
  | { type: "restoreList"; list: List }
  | { type: "restoreListFields"; listId: string; fields: Partial<List> };

export interface UndoEntry {
  id: string;
  timestamp: number;
  operation: string;
  description: string;
  undo: UndoAction;
}

interface UndoHistoryData {
  entries: UndoEntry[];
  maxEntries: number;
}

function getHistoryPath(): string {
  return path.join(getConfigDir(), "undo-history.json");
}

function loadHistory(): UndoHistoryData {
  const historyPath = getHistoryPath();
  try {
    const data = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { entries: [], maxEntries: MAX_ENTRIES };
  }
}

function saveHistory(data: UndoHistoryData): void {
  ensureConfigDir();
  const historyPath = getHistoryPath();
  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
}

export function recordUndo(
  operation: string,
  description: string,
  undo: UndoAction
): void {
  const history = loadHistory();
  
  const entry: UndoEntry = {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    operation,
    description,
    undo,
  };
  
  history.entries.push(entry);
  
  // Prune oldest entries if over limit
  while (history.entries.length > history.maxEntries) {
    history.entries.shift();
  }
  
  saveHistory(history);
}

export function getUndoEntries(limit?: number): UndoEntry[] {
  const history = loadHistory();
  const entries = [...history.entries].reverse(); // Most recent first
  return limit ? entries.slice(0, limit) : entries;
}

export function popUndoEntries(count: number): UndoEntry[] {
  const history = loadHistory();
  const popped: UndoEntry[] = [];
  
  for (let i = 0; i < count && history.entries.length > 0; i++) {
    const entry = history.entries.pop();
    if (entry) {
      popped.push(entry);
    }
  }
  
  saveHistory(history);
  return popped;
}

export function clearHistory(): void {
  saveHistory({ entries: [], maxEntries: MAX_ENTRIES });
}

export async function executeUndo(
  client: ITttClient,
  action: UndoAction
): Promise<void> {
  switch (action.type) {
    case "deleteTodo":
      await client.deleteTodo(action.todoId);
      break;
    case "batchDeleteTodos":
      await client.batchDeleteTodos(action.todoIds);
      break;
    case "restoreTodo":
      await client.restoreTodo(action.todo);
      break;
    case "restoreFields":
      await client.batchUpdateTodos(
        action.updates.map((u) => ({ id: u.id, fields: u.fields }))
      );
      break;
    case "deleteList":
      await client.deleteList(action.listId);
      break;
    case "restoreList":
      await client.restoreList(action.list);
      break;
    case "restoreListFields":
      await client.updateList(action.listId, action.fields);
      break;
  }
}

// Helper functions to record specific operations

export function recordAddTodo(todoId: string, text: string, listName: string): void {
  recordUndo("addTodo", `Added "${text}" to ${listName}`, {
    type: "deleteTodo",
    todoId,
  });
}

export function recordDeleteTodo(todo: Todo): void {
  recordUndo("deleteTodo", `Deleted "${todo.text}"`, {
    type: "restoreTodo",
    todo,
  });
}

export function recordBatchAdd(todoIds: string[], listName: string): void {
  recordUndo("batchAddTodos", `Added ${todoIds.length} todos to ${listName}`, {
    type: "batchDeleteTodos",
    todoIds,
  });
}

export function recordBatchUpdate(results: BatchUpdateResult[]): void {
  recordUndo("batchUpdateTodos", `Updated ${results.length} todos`, {
    type: "restoreFields",
    updates: results.map((r) => ({ id: r.id, fields: r.previousFields })),
  });
}

export function recordMarkDone(todo: Todo): void {
  recordUndo("markDone", `Marked "${todo.text}" as done`, {
    type: "restoreFields",
    updates: [{ id: todo.id, fields: { done: todo.done } }],
  });
}

export function recordMarkUndone(todo: Todo): void {
  recordUndo("markUndone", `Marked "${todo.text}" as not done`, {
    type: "restoreFields",
    updates: [{ id: todo.id, fields: { done: todo.done } }],
  });
}

export function recordUpdateTodo(result: BatchUpdateResult, text: string): void {
  recordUndo("updateTodo", `Updated "${text}"`, {
    type: "restoreFields",
    updates: [{ id: result.id, fields: result.previousFields }],
  });
}

// List operations

export function recordCreateList(listId: string, name: string): void {
  recordUndo("createList", `Created list "${name}"`, {
    type: "deleteList",
    listId,
  });
}

export function recordDeleteList(list: List): void {
  recordUndo("deleteList", `Deleted list "${list.name}"`, {
    type: "restoreList",
    list,
  });
}

export function recordUpdateList(result: ListUpdateResult, name: string): void {
  recordUndo("updateList", `Updated list "${name}"`, {
    type: "restoreListFields",
    listId: result.id,
    fields: result.previousFields,
  });
}
