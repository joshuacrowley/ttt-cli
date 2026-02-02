import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";

interface HeaderProps {
  command?: string;
}

export const Header: React.FC<HeaderProps> = ({ command }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Gradient name="rainbow">
          <Text bold>TTT</Text>
        </Gradient>
        <Text color="gray"> • </Text>
        <Gradient name="pastel">
          <Text>Tiny Talking Todos</Text>
        </Gradient>
        {command && (
          <>
            <Text color="gray"> • </Text>
            <Text color="cyan">{command}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text color="gray">{"─".repeat(50)}</Text>
      </Box>
    </Box>
  );
};

export default Header;
