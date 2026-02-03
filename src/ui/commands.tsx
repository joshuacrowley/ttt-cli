import React, { useState, useEffect } from "react";
import { render, Box, Text, useApp } from "ink";
import { Logo } from "../components/Logo.js";
import { Spinner } from "../components/Spinner.js";
import type { List, Todo } from "../api.js";

// === Welcome Screen (nice for human setup) ===

export const WelcomeScreen: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box flexDirection="column" alignItems="center" marginTop={1}>
        <Text color="gray">Your personal todo companion</Text>
        <Box marginTop={1}>
          <Text color="gray">Run </Text>
          <Text color="cyan">ttt --help</Text>
          <Text color="gray"> to get started</Text>
        </Box>
      </Box>
    </Box>
  );
};

// === Generic Async Wrapper ===

interface AsyncViewProps<T> {
  fetch: () => Promise<T>;
  render: (data: T) => React.ReactNode;
  loadingText?: string;
}

function AsyncView<T>({
  fetch,
  render: renderContent,
  loadingText = "Loading...",
}: AsyncViewProps<T>) {
  const { exit } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch()
      .then((result) => {
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || String(err));
          setLoading(false);
        }
      })
      .finally(() => {
        setTimeout(() => exit(), 100);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <Spinner label={loadingText} />;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return <>{data !== null ? renderContent(data) : null}</>;
}

// === Compact List Display ===

interface ListLsData {
  lists: List[];
  todos: Todo[];
}

interface ListLsViewProps {
  getData: () => Promise<ListLsData>;
}

export const ListLsView: React.FC<ListLsViewProps> = ({ getData }) => {
  return (
    <AsyncView<ListLsData>
      fetch={getData}
      loadingText="Fetching lists..."
      render={(data) => (
        <Box flexDirection="column">
          <Text bold>Lists ({data.lists.length}):</Text>
          {data.lists.length === 0 ? (
            <Text color="gray">No lists. Create one with: ttt list create &lt;name&gt;</Text>
          ) : (
            data.lists.map((list) => {
              const listTodos = data.todos.filter((t) => t.list === list.id);
              const done = listTodos.filter((t) => t.done).length;
              return (
                <Text key={list.id}>
                  • {list.name || "(unnamed)"} [{done}/{listTodos.length}] id:{list.id}
                </Text>
              );
            })
          )}
        </Box>
      )}
    />
  );
};

interface ListGetData {
  list: List;
  todos: Todo[];
}

interface ListGetViewProps {
  getData: () => Promise<ListGetData>;
}

export const ListGetView: React.FC<ListGetViewProps> = ({ getData }) => {
  return (
    <AsyncView<ListGetData>
      fetch={getData}
      loadingText="Fetching list..."
      render={(data) => {
        const done = data.todos.filter((t) => t.done).length;
        return (
          <Box flexDirection="column">
            <Text bold>{data.list.name || "(unnamed)"}</Text>
            <Text>id: {data.list.id}</Text>
            <Text>todos: {done}/{data.todos.length} done</Text>
            {data.list.type && <Text>type: {data.list.type}</Text>}
            {data.list.purpose && <Text>purpose: {data.list.purpose}</Text>}
          </Box>
        );
      }}
    />
  );
};

interface ListCreateData {
  id: string;
  name: string;
}

interface ListCreateViewProps {
  getData: () => Promise<ListCreateData>;
}

export const ListCreateView: React.FC<ListCreateViewProps> = ({ getData }) => {
  return (
    <AsyncView<ListCreateData>
      fetch={getData}
      loadingText="Creating list..."
      render={(data) => (
        <Text color="green">Created "{data.name}" id:{data.id}</Text>
      )}
    />
  );
};

// === List Update View ===

interface ListUpdateData {
  id: string;
  name: string;
}

interface ListUpdateViewProps {
  getData: () => Promise<ListUpdateData>;
}

export const ListUpdateView: React.FC<ListUpdateViewProps> = ({ getData }) => {
  return (
    <AsyncView<ListUpdateData>
      fetch={getData}
      loadingText="Updating list..."
      render={(data) => (
        <Text color="green">Updated list "{data.name}" id:{data.id}</Text>
      )}
    />
  );
};

// === List Delete View ===

interface ListDeleteData {
  id: string;
  name: string;
}

interface ListDeleteViewProps {
  getData: () => Promise<ListDeleteData>;
}

export const ListDeleteView: React.FC<ListDeleteViewProps> = ({ getData }) => {
  return (
    <AsyncView<ListDeleteData>
      fetch={getData}
      loadingText="Deleting list..."
      render={(data) => (
        <Text color="green">Deleted list "{data.name}" id:{data.id}</Text>
      )}
    />
  );
};

// === Compact Todo Display ===

interface TodoLsData {
  list: List;
  todos: Todo[];
}

interface TodoLsViewProps {
  getData: () => Promise<TodoLsData>;
}

export const TodoLsView: React.FC<TodoLsViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoLsData>
      fetch={getData}
      loadingText="Fetching todos..."
      render={(data) => {
        const done = data.todos.filter((t) => t.done).length;
        return (
          <Box flexDirection="column">
            <Text bold>{data.list.name || "(unnamed)"} [{done}/{data.todos.length}]</Text>
            {data.todos.length === 0 ? (
              <Text color="gray">No todos.</Text>
            ) : (
              data.todos.map((todo) => (
                <Text key={todo.id}>
                  {todo.done ? "✓" : "○"} {todo.text}{todo.category ? ` [${todo.category}]` : ""} id:{todo.id}
                </Text>
              ))
            )}
          </Box>
        );
      }}
    />
  );
};

interface TodoAddData {
  id: string;
  text: string;
  listName: string;
}

interface TodoAddViewProps {
  getData: () => Promise<TodoAddData>;
}

export const TodoAddView: React.FC<TodoAddViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoAddData>
      fetch={getData}
      loadingText="Adding todo..."
      render={(data) => (
        <Text color="green">Added to "{data.listName}": {data.text} id:{data.id}</Text>
      )}
    />
  );
};

interface TodoDoneData {
  id: string;
}

interface TodoDoneViewProps {
  getData: () => Promise<TodoDoneData>;
}

export const TodoDoneView: React.FC<TodoDoneViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoDoneData>
      fetch={getData}
      loadingText="Marking done..."
      render={(data) => (
        <Text color="green">Done: {data.id}</Text>
      )}
    />
  );
};

// === Todo Undone View ===

interface TodoUndoneData {
  id: string;
  text: string;
}

interface TodoUndoneViewProps {
  getData: () => Promise<TodoUndoneData>;
}

export const TodoUndoneView: React.FC<TodoUndoneViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoUndoneData>
      fetch={getData}
      loadingText="Marking not done..."
      render={(data) => (
        <Text color="green">Undone: "{data.text}" id:{data.id}</Text>
      )}
    />
  );
};

// === Todo Update View ===

interface TodoUpdateData {
  id: string;
  text: string;
}

interface TodoUpdateViewProps {
  getData: () => Promise<TodoUpdateData>;
}

export const TodoUpdateView: React.FC<TodoUpdateViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoUpdateData>
      fetch={getData}
      loadingText="Updating todo..."
      render={(data) => (
        <Text color="green">Updated: "{data.text}" id:{data.id}</Text>
      )}
    />
  );
};

// === Delete View ===

interface TodoDeleteData {
  id: string;
  text: string;
}

interface TodoDeleteViewProps {
  getData: () => Promise<TodoDeleteData>;
}

export const TodoDeleteView: React.FC<TodoDeleteViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoDeleteData>
      fetch={getData}
      loadingText="Deleting..."
      render={(data) => (
        <Text color="green">Deleted: "{data.text}" id:{data.id}</Text>
      )}
    />
  );
};

// === Batch Add View ===

interface TodoBatchAddData {
  ids: string[];
  listName: string;
}

interface TodoBatchAddViewProps {
  getData: () => Promise<TodoBatchAddData>;
}

export const TodoBatchAddView: React.FC<TodoBatchAddViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoBatchAddData>
      fetch={getData}
      loadingText="Adding todos..."
      render={(data) => (
        <Box flexDirection="column">
          <Text color="green">Added {data.ids.length} todos to "{data.listName}"</Text>
          {data.ids.map((id) => (
            <Text key={id} color="gray">  id:{id}</Text>
          ))}
        </Box>
      )}
    />
  );
};

// === Batch Update View ===

interface TodoBatchUpdateData {
  count: number;
}

interface TodoBatchUpdateViewProps {
  getData: () => Promise<TodoBatchUpdateData>;
}

export const TodoBatchUpdateView: React.FC<TodoBatchUpdateViewProps> = ({ getData }) => {
  return (
    <AsyncView<TodoBatchUpdateData>
      fetch={getData}
      loadingText="Updating todos..."
      render={(data) => (
        <Text color="green">Updated {data.count} todos</Text>
      )}
    />
  );
};

// === Undo View ===

interface UndoData {
  count: number;
  descriptions: string[];
}

interface UndoViewProps {
  getData: () => Promise<UndoData>;
}

export const UndoView: React.FC<UndoViewProps> = ({ getData }) => {
  return (
    <AsyncView<UndoData>
      fetch={getData}
      loadingText="Undoing..."
      render={(data) => (
        <Box flexDirection="column">
          <Text color="green">Undid {data.count} operation(s)</Text>
          {data.descriptions.map((desc, i) => (
            <Text key={i} color="gray">  • {desc}</Text>
          ))}
        </Box>
      )}
    />
  );
};

// === History View ===

interface HistoryEntry {
  id: string;
  timestamp: number;
  operation: string;
  description: string;
}

interface HistoryData {
  entries: HistoryEntry[];
}

interface HistoryViewProps {
  getData: () => Promise<HistoryData>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ getData }) => {
  return (
    <AsyncView<HistoryData>
      fetch={getData}
      loadingText="Loading history..."
      render={(data) => (
        <Box flexDirection="column">
          <Text bold>Undo History ({data.entries.length} entries):</Text>
          {data.entries.length === 0 ? (
            <Text color="gray">No operations to undo.</Text>
          ) : (
            data.entries.map((entry, i) => {
              const date = new Date(entry.timestamp);
              const timeStr = date.toLocaleTimeString();
              return (
                <Text key={entry.id}>
                  {i + 1}. [{timeStr}] {entry.description}
                </Text>
              );
            })
          )}
        </Box>
      )}
    />
  );
};

// === Auth Views ===

interface AuthStatusData {
  isLoggedIn: boolean;
  orgId?: string;
  configPath?: string;
  maskedToken?: string;
}

interface AuthStatusViewProps {
  getData: () => Promise<AuthStatusData>;
}

export const AuthStatusView: React.FC<AuthStatusViewProps> = ({ getData }) => {
  return (
    <AsyncView<AuthStatusData>
      fetch={getData}
      loadingText="Checking auth..."
      render={(data) => (
        <Box flexDirection="column">
          {data.isLoggedIn ? (
            <>
              <Text color="green">✓ Logged in</Text>
              <Text>org: {data.orgId}</Text>
              <Text>config: {data.configPath}</Text>
            </>
          ) : (
            <>
              <Text color="yellow">Not logged in</Text>
              <Text>Run: ttt auth login</Text>
            </>
          )}
        </Box>
      )}
    />
  );
};

// === Daemon Views ===

interface DaemonStatusData {
  isRunning: boolean;
  pid?: number;
  uptime?: number;
  stalePid?: number;
}

interface DaemonStatusViewProps {
  getData: () => Promise<DaemonStatusData>;
}

export const DaemonStatusView: React.FC<DaemonStatusViewProps> = ({ getData }) => {
  return (
    <AsyncView<DaemonStatusData>
      fetch={getData}
      loadingText="Checking daemon..."
      render={(data) => (
        <Box flexDirection="column">
          {data.isRunning ? (
            <>
              <Text color="green">● Daemon running</Text>
              <Text>pid: {data.pid} uptime: {data.uptime}s</Text>
            </>
          ) : (
            <>
              <Text color="gray">○ Daemon not running</Text>
              {data.stalePid && <Text color="yellow">Cleaned stale pid: {data.stalePid}</Text>}
            </>
          )}
        </Box>
      )}
    />
  );
};

// === Render Helpers ===

export function renderView(element: React.ReactElement): Promise<void> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(element);
    waitUntilExit().then(resolve);
  });
}

interface SimpleMessageProps {
  type: "success" | "error" | "info";
  message: string;
}

const SimpleMessage: React.FC<SimpleMessageProps> = ({ type, message }) => {
  const { exit } = useApp();

  useEffect(() => {
    setTimeout(() => exit(), 100);
  }, []);

  const color = type === "success" ? "green" : type === "error" ? "red" : "gray";
  const prefix = type === "success" ? "✓" : type === "error" ? "✗" : "•";

  return <Text color={color}>{prefix} {message}</Text>;
};

export function showMessage(
  type: "success" | "error" | "info",
  message: string
): Promise<void> {
  return renderView(<SimpleMessage type={type} message={message} />);
}

export function showSuccess(message: string): Promise<void> {
  return showMessage("success", message);
}

export function showError(message: string): Promise<void> {
  return showMessage("error", message);
}
