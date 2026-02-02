import React from "react";
import { Box, Text } from "ink";
import type { Todo, List } from "../api.js";

interface TodoItemProps {
  todo: Todo;
  showDetails?: boolean;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  showDetails = true,
}) => {
  const checkbox = todo.done ? "✅" : "⬜";
  const textColor = todo.done ? "gray" : "white";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text>{checkbox} </Text>
        <Text color={textColor} strikethrough={todo.done}>
          {todo.emoji ? `${todo.emoji} ` : ""}
          {todo.text}
        </Text>
        {todo.category && (
          <Text color="magenta"> [{todo.category}]</Text>
        )}
      </Box>

      {showDetails && (
        <Box flexDirection="column" marginLeft={3}>
          <Box>
            <Text color="gray">ID: </Text>
            <Text color="cyan">{todo.id}</Text>
          </Box>

          {todo.notes && (
            <Box>
              <Text color="gray">Notes: </Text>
              <Text color="white">{todo.notes}</Text>
            </Box>
          )}

          {todo.date && (
            <Box>
              <Text color="gray">📅 </Text>
              <Text color="yellow">{todo.date}</Text>
              {todo.time && <Text color="yellow"> at {todo.time}</Text>}
            </Box>
          )}

          {todo.url && (
            <Box>
              <Text color="gray">🔗 </Text>
              <Text color="blue">{todo.url}</Text>
            </Box>
          )}

          {todo.email && (
            <Box>
              <Text color="gray">📧 </Text>
              <Text color="cyan">{todo.email}</Text>
            </Box>
          )}

          {todo.streetAddress && (
            <Box>
              <Text color="gray">📍 </Text>
              <Text color="white">{todo.streetAddress}</Text>
            </Box>
          )}

          {todo.fiveStarRating !== undefined && todo.fiveStarRating > 0 && (
            <Box>
              <Text color="yellow">
                {"⭐".repeat(todo.fiveStarRating)}
                {"☆".repeat(5 - todo.fiveStarRating)}
              </Text>
            </Box>
          )}

          {todo.amount !== undefined && (
            <Box>
              <Text color="gray">💰 </Text>
              <Text color="green">${todo.amount.toFixed(2)}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

interface TodosDisplayProps {
  list: List;
  todos: Todo[];
}

export const TodosDisplay: React.FC<TodosDisplayProps> = ({ list, todos }) => {
  const doneCount = todos.filter((t) => t.done).length;
  const pendingCount = todos.length - doneCount;

  if (todos.length === 0) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text bold color="magenta">
            {list.icon || "📝"} {list.name}
          </Text>
        </Box>
        <Box>
          <Text color="gray">No todos in this list. Add one with </Text>
          <Text color="cyan">ttt todo add --list "{list.name}" "your todo"</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        marginBottom={1}
        borderStyle="single"
        borderColor="magenta"
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Box>
            <Text bold color="magenta">
              {list.icon || "📝"} {list.name}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              {todos.length} todos ({pendingCount} pending, {doneCount} done)
            </Text>
          </Box>
        </Box>
      </Box>

      <Box flexDirection="column">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </Box>
    </Box>
  );
};

export default TodosDisplay;
