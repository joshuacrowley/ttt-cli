#!/usr/bin/env node

import React from "react";
import { Command } from "commander";
import { render } from "ink";
import { login, logout, getAuthData } from "./auth.js";
import { TttClient } from "./api.js";
import { DaemonClient } from "./daemon-client.js";
import type { ITttClient } from "./types.js";
import { getDaemonPidPath, loadConfig, getConfigPath } from "./config.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Load version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);
const VERSION: string = packageJson.version;
import {
  WelcomeScreen,
  ListLsView,
  ListGetView,
  ListCreateView,
  ListUpdateView,
  ListDeleteView,
  TodoLsView,
  TodoAddView,
  TodoDoneView,
  TodoUndoneView,
  TodoUpdateView,
  TodoDeleteView,
  TodoBatchAddView,
  TodoBatchUpdateView,
  UndoView,
  HistoryView,
  AuthStatusView,
  DaemonStatusView,
  renderView,
  showSuccess,
  showError,
} from "./ui/commands.js";
import {
  recordAddTodo,
  recordDeleteTodo,
  recordBatchAdd,
  recordBatchUpdate,
  recordMarkDone,
  recordMarkUndone,
  recordUpdateTodo,
  recordCreateList,
  recordDeleteList,
  recordUpdateList,
  getUndoEntries,
  popUndoEntries,
  executeUndo,
} from "./undo-history.js";
import type { BatchAddItem, BatchUpdateItem } from "./types.js";

// Helper to wrap showSuccess/showError for backward compat
const success = (msg: string) => showSuccess(msg);
const error = (msg: string) => showError(msg);

async function getClient(): Promise<ITttClient> {
  const daemon = new DaemonClient();
  try {
    await daemon.connect();
    return daemon;
  } catch {
    // Daemon unavailable — fall back to direct connection
    const direct = new TttClient();
    await direct.connect();
    return direct;
  }
}

const program = new Command();

program
  .name("ttt")
  .description("TinyTalkingTodos CLI - Manage your todo lists from the command line")
  .version(VERSION)
  .action(async () => {
    // Show welcome screen when no command is provided
    await renderView(<WelcomeScreen />);
  });

// Auth commands
const auth = program.command("auth").description("Authentication commands");

auth
  .command("login")
  .description("Login to TinyTalkingTodos")
  .action(async () => {
    // Stop running daemon so next command uses fresh credentials
    try {
      const daemon = new DaemonClient();
      await daemon.connect();
      await daemon.shutdown();
    } catch {
      // No daemon running — fine
    }
    await login();
  });

auth
  .command("logout")
  .description("Logout from TinyTalkingTodos")
  .action(async () => {
    // Stop running daemon
    try {
      const daemon = new DaemonClient();
      await daemon.connect();
      await daemon.shutdown();
    } catch {
      // No daemon running — fine
    }
    await logout();
  });

auth
  .command("status")
  .description("Show current authentication status")
  .action(async () => {
    await renderView(
      <AuthStatusView
        getData={async () => {
          const data = getAuthData();
          return {
            isLoggedIn: data.isLoggedIn,
            orgId: data.orgId,
            configPath: data.configPath,
            maskedToken: data.maskedToken,
          };
        }}
      />
    );
  });

auth
  .command("export")
  .description("Output env vars for other tools (TTT_TOKEN, TTT_ORG_ID)")
  .action(async () => {
    const config = loadConfig();

    if (!config.sessionToken || !config.orgId) {
      await error("Not logged in. Run 'ttt auth login' first.");
      process.exit(1);
    }

    // For export, we output raw text for shell eval
    console.log(`export TTT_TOKEN="${config.sessionToken}"`);
    console.log(`export TTT_ORG_ID="${config.orgId}"`);
  });

// Daemon commands
const daemonCmd = program.command("daemon").description("Manage background daemon");

daemonCmd
  .command("start")
  .description("Start the background daemon")
  .action(async () => {
    try {
      const daemon = new DaemonClient();
      await daemon.connect();
      const info = await daemon.ping();
      await success(`Daemon running pid:${info.pid} uptime:${info.uptime}s`);
      await daemon.disconnect();
    } catch (err: any) {
      await error(`Failed to start daemon: ${err.message}`);
      process.exit(1);
    }
  });

daemonCmd
  .command("stop")
  .description("Stop the background daemon")
  .action(async () => {
    try {
      const daemon = new DaemonClient();
      await daemon.connect({ autoStart: false });
      await daemon.shutdown();
      await success("Daemon stopped");
    } catch {
      await success("Daemon not running");
    }
  });

daemonCmd
  .command("status")
  .description("Show daemon status")
  .action(async () => {
    await renderView(
      <DaemonStatusView
        getData={async () => {
          try {
            const daemon = new DaemonClient();
            await daemon.connect({ autoStart: false });
            const info = await daemon.ping();
            await daemon.disconnect();
            return {
              isRunning: true,
              pid: info.pid,
              uptime: info.uptime,
              version: info.version,
            };
          } catch {
            // Check for stale PID file
            const pidPath = getDaemonPidPath();
            try {
              const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
              fs.unlinkSync(pidPath);
              return { isRunning: false, stalePid: pid };
            } catch {
              return { isRunning: false };
            }
          }
        }}
      />
    );
  });

// List commands
const list = program.command("list").description("Manage lists");

list
  .command("ls")
  .description("List all todo lists")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    if (options.json) {
      // JSON output - no Ink
      let client: ITttClient | undefined;
      try {
        client = await getClient();
        const lists = await client.getLists();
        console.log(JSON.stringify(lists, null, 2));
        await client.disconnect();
      } catch (error: any) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
      return;
    }

    await renderView(
      <ListLsView
        getData={async () => {
          const client = await getClient();
          const lists = await client.getLists();
          const todos = await client.getTodos();
          await client.disconnect();
          return { lists, todos };
        }}
      />
    );
  });

list
  .command("get <name-or-id>")
  .description("Get details for a single list")
  .option("--json", "Output as JSON")
  .action(async (nameOrId, options) => {
    if (options.json) {
      let client: ITttClient | undefined;
      try {
        client = await getClient();
        const found = await client.findListByNameOrId(nameOrId);
        if (!found) {
          console.error(JSON.stringify({ error: `List not found: ${nameOrId}` }));
          process.exit(1);
        }
        const todos = await client.getTodos(found.id);
        console.log(
          JSON.stringify(
            { ...found, todoCount: todos.length, doneCount: todos.filter((t) => t.done).length },
            null,
            2
          )
        );
        await client.disconnect();
      } catch (error: any) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
      return;
    }

    await renderView(
      <ListGetView
        getData={async () => {
          const client = await getClient();
          const found = await client.findListByNameOrId(nameOrId);
          if (!found) {
            throw new Error(`List not found: ${nameOrId}`);
          }
          const todos = await client.getTodos(found.id);
          await client.disconnect();
          return { list: found, todos };
        }}
      />
    );
  });

list
  .command("create <name>")
  .description("Create a new list")
  .option("--color <color>", "List color", "blue")
  .option("--type <type>", "List type", "Info")
  .option("--icon <icon>", "List icon")
  .action(async (name, options) => {
    await renderView(
      <ListCreateView
        getData={async () => {
          const client = await getClient();
          const id = await client.createList(name, {
            color: options.color,
            type: options.type,
            icon: options.icon,
          });
          recordCreateList(id, name);
          await client.disconnect();
          return { id, name };
        }}
      />
    );
  });

list
  .command("update <name-or-id>")
  .description("Update a list")
  .option("--name <name>", "New list name")
  .option("--color <color>", "List color")
  .option("--type <type>", "List type")
  .option("--icon <icon>", "List icon")
  .action(async (nameOrId, options) => {
    await renderView(
      <ListUpdateView
        getData={async () => {
          const client = await getClient();
          const foundList = await client.findListByNameOrId(nameOrId);
          if (!foundList) {
            throw new Error(`List not found: ${nameOrId}`);
          }
          
          const fields: Record<string, string> = {};
          if (options.name) fields.name = options.name;
          if (options.color) fields.backgroundColour = options.color;
          if (options.type) fields.type = options.type;
          if (options.icon) fields.icon = options.icon;
          
          if (Object.keys(fields).length === 0) {
            throw new Error("No fields to update. Use --name, --color, --type, or --icon");
          }
          
          const result = await client.updateList(foundList.id, fields);
          recordUpdateList(result, options.name || foundList.name);
          await client.disconnect();
          return { id: foundList.id, name: options.name || foundList.name };
        }}
      />
    );
  });

list
  .command("delete <name-or-id>")
  .alias("rm")
  .description("Delete a list")
  .option("--force", "Delete even if list has todos")
  .action(async (nameOrId, options) => {
    await renderView(
      <ListDeleteView
        getData={async () => {
          const client = await getClient();
          const foundList = await client.findListByNameOrId(nameOrId);
          if (!foundList) {
            throw new Error(`List not found: ${nameOrId}`);
          }
          
          // Check if list has todos
          if (!options.force) {
            const todos = await client.getTodos(foundList.id);
            if (todos.length > 0) {
              throw new Error(`List has ${todos.length} todos. Use --force to delete anyway.`);
            }
          }
          
          const deletedList = await client.deleteList(foundList.id);
          recordDeleteList(deletedList);
          await client.disconnect();
          return { id: foundList.id, name: deletedList.name };
        }}
      />
    );
  });

// Todo commands
const todo = program.command("todo").description("Manage todos");

todo
  .command("add <text>")
  .description("Add a todo to a list")
  .requiredOption("--list <name-or-id>", "List name or ID")
  .option("--notes <notes>", "Additional notes")
  .option("--date <date>", "Date (e.g. 2025-02-02)")
  .option("--time <time>", "Time (e.g. 15:00)")
  .option("--url <url>", "URL")
  .option("--emoji <emoji>", "Emoji")
  .option("--email <email>", "Email address")
  .option("--street-address <address>", "Street address")
  .option("--number <n>", "Number value", parseFloat)
  .option("--amount <n>", "Amount value", parseFloat)
  .option("--rating <n>", "Star rating (1-5)", parseInt)
  .option("--type <type>", "Type (A-E)")
  .option("--category <category>", "Category")
  .action(async (text, options) => {
    await renderView(
      <TodoAddView
        getData={async () => {
          const client = await getClient();
          const foundList = await client.findListByNameOrId(options.list);
          if (!foundList) {
            throw new Error(`List not found: ${options.list}`);
          }
          const id = await client.addTodo(foundList.id, text, {
            notes: options.notes,
            date: options.date,
            time: options.time,
            url: options.url,
            emoji: options.emoji,
            email: options.email,
            streetAddress: options.streetAddress,
            number: options.number,
            amount: options.amount,
            fiveStarRating: options.rating,
            type: options.type,
            category: options.category,
          });
          recordAddTodo(id, text, foundList.name);
          await client.disconnect();
          return { id, text, listName: foundList.name };
        }}
      />
    );
  });

todo
  .command("ls")
  .description("List todos in a list")
  .requiredOption("--list <name-or-id>", "List name or ID")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    if (options.json) {
      let client: ITttClient | undefined;
      try {
        client = await getClient();
        const foundList = await client.findListByNameOrId(options.list);
        if (!foundList) {
          console.error(JSON.stringify({ error: `List not found: ${options.list}` }));
          process.exit(1);
        }
        const todos = await client.getTodos(foundList.id);
        console.log(JSON.stringify(todos, null, 2));
        await client.disconnect();
      } catch (error: any) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
      return;
    }

    await renderView(
      <TodoLsView
        getData={async () => {
          const client = await getClient();
          const foundList = await client.findListByNameOrId(options.list);
          if (!foundList) {
            throw new Error(`List not found: ${options.list}`);
          }
          const todos = await client.getTodos(foundList.id);
          await client.disconnect();
          return { list: foundList, todos };
        }}
      />
    );
  });

todo
  .command("done <id>")
  .description("Mark a todo as complete")
  .action(async (id) => {
    await renderView(
      <TodoDoneView
        getData={async () => {
          const client = await getClient();
          const previousTodo = await client.markTodoDone(id);
          recordMarkDone(previousTodo);
          await client.disconnect();
          return { id };
        }}
      />
    );
  });

todo
  .command("undone <id>")
  .description("Mark a todo as not complete")
  .action(async (id) => {
    await renderView(
      <TodoUndoneView
        getData={async () => {
          const client = await getClient();
          const previousTodo = await client.markTodoUndone(id);
          recordMarkUndone(previousTodo);
          await client.disconnect();
          return { id, text: previousTodo.text };
        }}
      />
    );
  });

todo
  .command("update <id>")
  .description("Update a todo")
  .option("--text <text>", "New todo text")
  .option("--notes <notes>", "Additional notes")
  .option("--date <date>", "Date (e.g. 2025-02-02)")
  .option("--time <time>", "Time (e.g. 15:00)")
  .option("--url <url>", "URL")
  .option("--emoji <emoji>", "Emoji")
  .option("--email <email>", "Email address")
  .option("--street-address <address>", "Street address")
  .option("--number <n>", "Number value", parseFloat)
  .option("--amount <n>", "Amount value", parseFloat)
  .option("--rating <n>", "Star rating (1-5)", parseInt)
  .option("--type <type>", "Type (A-E)")
  .option("--category <category>", "Category")
  .option("--done", "Mark as done")
  .option("--not-done", "Mark as not done")
  .action(async (id, options) => {
    await renderView(
      <TodoUpdateView
        getData={async () => {
          const client = await getClient();
          
          const fields: Record<string, any> = {};
          if (options.text) fields.text = options.text;
          if (options.notes !== undefined) fields.notes = options.notes;
          if (options.date !== undefined) fields.date = options.date;
          if (options.time !== undefined) fields.time = options.time;
          if (options.url !== undefined) fields.url = options.url;
          if (options.emoji !== undefined) fields.emoji = options.emoji;
          if (options.email !== undefined) fields.email = options.email;
          if (options.streetAddress !== undefined) fields.streetAddress = options.streetAddress;
          if (options.number !== undefined) fields.number = options.number;
          if (options.amount !== undefined) fields.amount = options.amount;
          if (options.rating !== undefined) fields.fiveStarRating = options.rating;
          if (options.type !== undefined) fields.type = options.type;
          if (options.category !== undefined) fields.category = options.category;
          if (options.done) fields.done = true;
          if (options.notDone) fields.done = false;
          
          if (Object.keys(fields).length === 0) {
            throw new Error("No fields to update");
          }
          
          const result = await client.updateTodo(id, fields);
          
          // Get the current text for display
          const todos = await client.getTodos();
          const todo = todos.find(t => t.id === id);
          const text = options.text || todo?.text || id;
          
          recordUpdateTodo(result, text);
          await client.disconnect();
          return { id, text };
        }}
      />
    );
  });

todo
  .command("delete <id>")
  .alias("rm")
  .description("Delete a todo")
  .action(async (id) => {
    await renderView(
      <TodoDeleteView
        getData={async () => {
          const client = await getClient();
          const deletedTodo = await client.deleteTodo(id);
          recordDeleteTodo(deletedTodo);
          await client.disconnect();
          return { id, text: deletedTodo.text };
        }}
      />
    );
  });

todo
  .command("batch-add")
  .description("Add multiple todos at once")
  .requiredOption("--list <name-or-id>", "List name or ID")
  .requiredOption("--items <json>", "JSON array of items")
  .action(async (options) => {
    let items: BatchAddItem[];
    try {
      items = JSON.parse(options.items);
      if (!Array.isArray(items)) {
        throw new Error("Items must be an array");
      }
    } catch (err: any) {
      await error(`Invalid JSON: ${err.message}`);
      process.exit(1);
      return;
    }

    await renderView(
      <TodoBatchAddView
        getData={async () => {
          const client = await getClient();
          const foundList = await client.findListByNameOrId(options.list);
          if (!foundList) {
            throw new Error(`List not found: ${options.list}`);
          }
          const ids = await client.batchAddTodos(foundList.id, items);
          recordBatchAdd(ids, foundList.name);
          await client.disconnect();
          return { ids, listName: foundList.name };
        }}
      />
    );
  });

todo
  .command("batch-update")
  .description("Update multiple todos at once")
  .requiredOption("--items <json>", "JSON array of updates")
  .action(async (options) => {
    let updates: BatchUpdateItem[];
    try {
      updates = JSON.parse(options.items);
      if (!Array.isArray(updates)) {
        throw new Error("Items must be an array");
      }
    } catch (err: any) {
      await error(`Invalid JSON: ${err.message}`);
      process.exit(1);
      return;
    }

    await renderView(
      <TodoBatchUpdateView
        getData={async () => {
          const client = await getClient();
          const results = await client.batchUpdateTodos(updates);
          recordBatchUpdate(results);
          await client.disconnect();
          return { count: results.length };
        }}
      />
    );
  });

// Undo command
program
  .command("undo [count]")
  .description("Undo the last N operations (default: 1)")
  .action(async (countStr = "1") => {
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 1) {
      await error("Count must be a positive number");
      process.exit(1);
      return;
    }

    await renderView(
      <UndoView
        getData={async () => {
          const entries = popUndoEntries(count);
          if (entries.length === 0) {
            throw new Error("No operations to undo");
          }

          const client = await getClient();
          const descriptions: string[] = [];

          for (const entry of entries) {
            await executeUndo(client, entry.undo);
            descriptions.push(entry.description);
          }

          await client.disconnect();
          return { count: entries.length, descriptions };
        }}
      />
    );
  });

// History command
program
  .command("history")
  .description("Show undo history")
  .option("--json", "Output as JSON")
  .option("--limit <n>", "Limit entries shown", "10")
  .action(async (options) => {
    const limit = parseInt(options.limit, 10);
    const entries = getUndoEntries(limit);

    if (options.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    await renderView(
      <HistoryView
        getData={async () => ({ entries })}
      />
    );
  });

program.parse();
