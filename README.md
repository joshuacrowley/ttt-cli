# ttt-cli

Command-line interface for [TinyTalkingTodos](https://tinytalkingtodos.com) - manage your todo lists from the terminal.

## Installation

```bash
npm install -g ttt-cli
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
```

### Todos

```bash
ttt todo ls --list <name-or-id>              # List todos
ttt todo ls --list <name-or-id> --json       # JSON output
ttt todo add <text> --list <name-or-id>      # Add a todo
ttt todo done <id>                           # Mark complete
```

#### Todo Options

```bash
ttt todo add "Task" --list "List" \
  --notes "Additional notes" \
  --date 2025-02-02 \
  --time 15:00 \
  --category "Work" \
  --emoji "📝"
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

## Requirements

- Node.js 18+
- A TinyTalkingTodos account

## License

MIT
