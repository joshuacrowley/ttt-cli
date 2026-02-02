import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";

interface LogoProps {
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ showTagline = true }) => {
  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      <Gradient name="rainbow">
        <BigText text="TTT" font="simple3d" />
      </Gradient>
      {showTagline && (
        <Box marginTop={-1}>
          <Gradient name="pastel">
            <Text>✨ Tiny Talking Todos ✨</Text>
          </Gradient>
        </Box>
      )}
    </Box>
  );
};

export default Logo;
