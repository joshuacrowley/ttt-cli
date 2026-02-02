import React from "react";
import { Box, Text } from "ink";

type StatusType = "success" | "error" | "warning" | "info";

interface StatusBoxProps {
  type: StatusType;
  title?: string;
  children: React.ReactNode;
}

const statusConfig: Record<
  StatusType,
  { icon: string; color: string; borderColor: string }
> = {
  success: { icon: "✓", color: "green", borderColor: "green" },
  error: { icon: "✗", color: "red", borderColor: "red" },
  warning: { icon: "⚠", color: "yellow", borderColor: "yellow" },
  info: { icon: "ℹ", color: "cyan", borderColor: "cyan" },
};

export const StatusBox: React.FC<StatusBoxProps> = ({
  type,
  title,
  children,
}) => {
  const config = statusConfig[type];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={config.borderColor}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {title && (
        <Box marginBottom={1}>
          <Text color={config.color} bold>
            {config.icon} {title}
          </Text>
        </Box>
      )}
      <Box>{children}</Box>
    </Box>
  );
};

interface MessageProps {
  type: StatusType;
  children: React.ReactNode;
}

export const Message: React.FC<MessageProps> = ({ type, children }) => {
  const config = statusConfig[type];

  return (
    <Box marginY={1}>
      <Text color={config.color}>{config.icon}</Text>
      <Text> </Text>
      <Text>{children}</Text>
    </Box>
  );
};

export default StatusBox;
