import React from "react";
import { Box, Text } from "ink";
import type { List, Todo } from "../api.js";

interface ListCardProps {
  list: List;
  todoCount: number;
  doneCount: number;
}

export const ListCard: React.FC<ListCardProps> = ({
  list,
  todoCount,
  doneCount,
}) => {
  const progress = todoCount > 0 ? Math.round((doneCount / todoCount) * 100) : 0;
  const progressWidth = 20;
  const filled = Math.round((progress / 100) * progressWidth);
  const empty = progressWidth - filled;

  const progressBar = "█".repeat(filled) + "░".repeat(empty);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      <Box>
        <Text>{list.icon || "📝"} </Text>
        <Text bold color="white">
          {list.name}
        </Text>
        {list.type && (
          <Text color="gray"> ({list.type})</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">ID: </Text>
        <Text color="cyan">{list.id}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Progress: </Text>
        <Text color={progress === 100 ? "green" : progress > 50 ? "yellow" : "cyan"}>
          {progressBar}
        </Text>
        <Text color="gray"> {doneCount}/{todoCount}</Text>
      </Box>
    </Box>
  );
};

interface ListsDisplayProps {
  lists: List[];
  todos: Todo[];
}

export const ListsDisplay: React.FC<ListsDisplayProps> = ({ lists, todos }) => {
  if (lists.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="gray">No lists found. Create one with </Text>
        <Text color="cyan">ttt list create &lt;name&gt;</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          📋 Your Lists ({lists.length})
        </Text>
      </Box>
      {lists.map((list) => {
        const listTodos = todos.filter((t) => t.list === list.id);
        const doneCount = listTodos.filter((t) => t.done).length;
        return (
          <ListCard
            key={list.id}
            list={list}
            todoCount={listTodos.length}
            doneCount={doneCount}
          />
        );
      })}
    </Box>
  );
};

export default ListsDisplay;
