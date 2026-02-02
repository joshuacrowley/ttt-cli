import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import { Header } from "../components/Header.js";
import { Spinner } from "../components/Spinner.js";
import { Message } from "../components/StatusBox.js";

interface AppProps {
  command?: string;
  children?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
}

export const App: React.FC<AppProps> = ({
  command,
  children,
  loading = false,
  loadingMessage = "Loading...",
}) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Header command={command} />
      {loading ? <Spinner label={loadingMessage} /> : children}
    </Box>
  );
};

interface RenderOptions {
  command?: string;
}

type RenderFunction = () => Promise<React.ReactNode>;

export async function renderApp(
  renderContent: RenderFunction,
  options: RenderOptions = {}
): Promise<void> {
  const LoadingApp: React.FC = () => {
    const [content, setContent] = useState<React.ReactNode>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let mounted = true;

      renderContent()
        .then((result) => {
          if (mounted) {
            setContent(result);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (mounted) {
            setError(err.message || String(err));
            setLoading(false);
          }
        });

      return () => {
        mounted = false;
      };
    }, []);

    return (
      <App command={options.command} loading={loading}>
        {error ? (
          <Message type="error">{error}</Message>
        ) : (
          content
        )}
      </App>
    );
  };

  const { waitUntilExit } = render(<LoadingApp />);
  await waitUntilExit();
}

export function renderSync(element: React.ReactElement): void {
  const { unmount } = render(element);
  // For sync renders, we just show and exit
  setTimeout(() => unmount(), 0);
}
