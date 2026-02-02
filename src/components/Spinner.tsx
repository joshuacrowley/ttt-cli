import React from "react";
import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import chalk from "chalk";

interface SpinnerProps {
  label?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  label = "Loading...",
  color = "cyan",
}) => {
  return (
    <Box>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
};

interface ConnectingSpinnerProps {
  stage?: "daemon" | "server" | "syncing" | "ready";
}

export const ConnectingSpinner: React.FC<ConnectingSpinnerProps> = ({
  stage = "daemon",
}) => {
  const messages: Record<string, string> = {
    daemon: "Connecting to daemon...",
    server: "Connecting to server...",
    syncing: "Syncing data...",
    ready: "Ready!",
  };

  const colors: Record<string, string> = {
    daemon: "yellow",
    server: "cyan",
    syncing: "magenta",
    ready: "green",
  };

  if (stage === "ready") {
    return (
      <Box>
        <Text color="green">✓</Text>
        <Text> {messages[stage]}</Text>
      </Box>
    );
  }

  return <Spinner label={messages[stage]} color={colors[stage]} />;
};

export default Spinner;
