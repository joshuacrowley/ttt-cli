import React from "react";
import { Box, Text } from "ink";

interface AuthStatusDisplayProps {
  isLoggedIn: boolean;
  orgId?: string;
  configPath?: string;
  maskedToken?: string;
}

export const AuthStatusDisplay: React.FC<AuthStatusDisplayProps> = ({
  isLoggedIn,
  orgId,
  configPath,
  maskedToken,
}) => {
  if (!isLoggedIn) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text color="yellow">⚠ </Text>
          <Text>Not logged in</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Run </Text>
          <Text color="cyan">ttt auth login</Text>
          <Text color="gray"> to authenticate.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color="green" bold>
          ✓ Authenticated
        </Text>
      </Box>

      <Box>
        <Text color="gray">Organization: </Text>
        <Text color="cyan">{orgId}</Text>
      </Box>

      <Box>
        <Text color="gray">Config: </Text>
        <Text color="white">{configPath}</Text>
      </Box>

      {maskedToken && (
        <Box>
          <Text color="gray">Token: </Text>
          <Text color="gray">{maskedToken}</Text>
        </Box>
      )}
    </Box>
  );
};

interface DaemonStatusDisplayProps {
  isRunning: boolean;
  pid?: number;
  uptime?: number;
  stalePid?: number;
}

export const DaemonStatusDisplay: React.FC<DaemonStatusDisplayProps> = ({
  isRunning,
  pid,
  uptime,
  stalePid,
}) => {
  if (!isRunning) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text color="gray">○ </Text>
          <Text>Daemon is not running</Text>
        </Box>
        {stalePid && (
          <Box marginTop={1}>
            <Text color="yellow">
              (Cleaned up stale PID file for process {stalePid})
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color="green" bold>
          ● Daemon Running
        </Text>
      </Box>

      <Box>
        <Text color="gray">PID: </Text>
        <Text color="cyan">{pid}</Text>
      </Box>

      <Box>
        <Text color="gray">Uptime: </Text>
        <Text color="white">{formatUptime(uptime || 0)}</Text>
      </Box>
    </Box>
  );
};

export default AuthStatusDisplay;
