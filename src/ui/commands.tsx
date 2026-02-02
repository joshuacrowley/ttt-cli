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
