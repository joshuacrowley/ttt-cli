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
import {
  WelcomeScreen,
  ListLsView,
  ListGetView,
  ListCreateView,
  TodoLsView,
  TodoAddView,
  TodoDoneView,
  AuthStatusView,
  DaemonStatusView,
  renderView,
  showSuccess,
  showError,
} from "./ui/commands.js";

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
  .version("0.1.0")
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
          await client.disconnect();
          return { id, name };
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
          await client.markTodoDone(id);
          await client.disconnect();
          return { id };
        }}
      />
    );
  });

program.parse();
