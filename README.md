# ttt-cli

Command-line interface for [TinyTalkingTodos](https://tinytalkingtodos.com) - manage your todo lists from the terminal.

## Installation

```bash
npm install -g @ojschwa/ttt-cli
```

## Quick Start

```bash
# Login to your account
ttt auth login

# List your todo lists
ttt list ls

# View todos in a list
ttt todo ls --list "My List"

# Add a todo
ttt todo add "Buy groceries" --list "My List"

# Mark as done
ttt todo done <todo-id>
```

## Commands

### Authentication

```bash
ttt auth login    # Login via browser
ttt auth logout   # Logout
ttt auth status   # Check login status
ttt auth export   # Export env vars for scripts
```

### Lists

```bash
ttt list ls                      # List all lists
ttt list ls --json               # JSON output
ttt list get <name-or-id>        # Get list details
ttt list create <name>           # Create a new list
ttt list update <name-or-id>     # Update a list
ttt list delete <name-or-id>     # Delete a list (alias: rm)
```

#### List Options

```bash
# Create with options
ttt list create "My List" --color "blue" --type "Info" --icon "📋"

# Update a list
ttt list update "My List" --name "New Name" --color "green" --icon "✅"

# Delete (use --force if list has todos)
ttt list delete "Old List" --force
```

### Todos

```bash
ttt todo ls --list <name-or-id>              # List todos
ttt todo ls --list <name-or-id> --json       # JSON output
ttt todo add <text> --list <name-or-id>      # Add a todo
ttt todo update <id>                         # Update a todo
ttt todo done <id>                           # Mark complete
ttt todo undone <id>                         # Mark not complete
ttt todo delete <id>                         # Delete a todo (alias: rm)
```

#### Todo Options

```bash
ttt todo add "Task" --list "List" \
  --notes "Additional notes" \
  --date 2026-02-02 \
  --time 15:00 \
  --category "Work" \
  --emoji "📝" \
  --url "https://example.com" \
  --email "user@example.com" \
  --street-address "123 Main St" \
  --number 42 \
  --amount 99.99 \
  --rating 5 \
  --type "A"
```

#### Update a Todo

```bash
ttt todo update <id> --text "New text" --category "Urgent"
ttt todo update <id> --done      # Mark as done
ttt todo update <id> --not-done  # Mark as not done
```

### Batch Operations

Add or update multiple todos at once using JSON:

```bash
# Batch add
ttt todo batch-add --list "Groceries" --items '[
  {"text": "Milk"},
  {"text": "Eggs", "fields": {"category": "Dairy"}},
  {"text": "Bread", "fields": {"amount": 3.50}}
]'

# Batch update
ttt todo batch-update --items '[
  {"id": "todo-abc123", "fields": {"done": true}},
  {"id": "todo-def456", "fields": {"text": "Updated", "category": "Urgent"}}
]'
```

### Undo

All mutating operations can be undone:

```bash
ttt undo           # Undo the last operation
ttt undo 3         # Undo the last 3 operations
ttt history        # View undo history
ttt history --json # JSON output
```

### Daemon (for faster commands)

The daemon keeps a persistent connection for faster subsequent commands:

```bash
ttt daemon start   # Start background daemon
ttt daemon stop    # Stop daemon
ttt daemon status  # Check daemon status
```

## Output Formats

Default output is compact and token-efficient (great for LLM agents):

```
Today [1/6]
✓ Morning walk id:abc123
○ Buy groceries id:def456
```

Use `--json` for structured output:

```bash
ttt list ls --json
ttt todo ls --list "Today" --json
```

## OpenClaw Integration

This CLI includes an [OpenClaw](https://openclaw.dev) skill that lets AI agents manage your todo lists.

### Setup

1. Install and authenticate the CLI:

```bash
npm install -g @ojschwa/ttt-cli
ttt auth login
```

2. Install the skill via [ClawHub](https://clawhub.ai):

```bash
clawhub install ttt
```

3. Restart your gateway (or wait for the skills watcher to pick it up)

That's it — your agent can now manage your todo lists.

### Manual Installation

Alternatively, copy the skill directly from this repo:

```bash
mkdir -p ~/.openclaw/workspace/skills/ttt
curl -o ~/.openclaw/workspace/skills/ttt/SKILL.md \
  https://raw.githubusercontent.com/joshuacrowley/ttt-cli/main/skills/ttt/SKILL.md
```

### Skill Documentation

See [`skills/ttt/SKILL.md`](skills/ttt/SKILL.md) for the full skill documentation, including all commands, options, and example workflows.

## Requirements

- Node.js 18+
- A TinyTalkingTodos account

## License

MIT
