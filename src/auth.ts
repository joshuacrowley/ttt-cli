import * as http from "http";
import * as crypto from "crypto";
import open from "open";
import { loadConfig, saveConfig, clearConfig, isLoggedIn, getConfigPath } from "./config.js";

const WEB_APP_URL = "https://app.tinytalkingtodos.com";
const LOGIN_TIMEOUT_MS = 120_000; // 2 minutes

export async function login(): Promise<void> {
  if (isLoggedIn()) {
    console.log("You are already logged in. Use 'ttt auth logout' to log out first.");
    return;
  }

  console.log("\nOpening browser to sign in...\n");

  const state = crypto.randomBytes(16).toString("hex");

  const { port, server } = await startCallbackServer(state);

  const authUrl = `${WEB_APP_URL}/cli-auth?port=${port}&state=${state}`;

  try {
    await open(authUrl);
  } catch {
    console.log(`Could not open browser automatically. Please visit:\n${authUrl}\n`);
  }

  console.log("Waiting for authentication...");

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      server.close();
      console.error("\nLogin timed out. Please try again.");
      console.error("If your browser didn't open, visit:");
      console.error(`  ${authUrl}`);
      process.exit(1);
    }, LOGIN_TIMEOUT_MS);

    server.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function startCallbackServer(
  expectedState: string
): Promise<{ port: number; server: http.Server }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const token = url.searchParams.get("token");
      const orgId = url.searchParams.get("orgId");
      const state = url.searchParams.get("state");

      if (state !== expectedState) {
        res.writeHead(400);
        res.end("Invalid state parameter. This may be a CSRF attack. Please try again.");
        return;
      }

      if (!token || !orgId) {
        res.writeHead(400);
        res.end("Missing token or orgId.");
        return;
      }

      saveConfig({ sessionToken: token, orgId });

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h1>Logged in!</h1>
              <p>You can close this tab and return to your terminal.</p>
            </div>
          </body>
        </html>
      `);

      console.log("\nLogin successful!");
      console.log(`Config saved to ${getConfigPath()}`);

      // Shut down the server after responding
      setTimeout(() => server.close(), 500);
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start callback server"));
        return;
      }
      resolve({ port: addr.port, server });
    });

    server.on("error", reject);
  });
}

export async function logout(): Promise<void> {
  if (!isLoggedIn()) {
    console.log("You are not logged in.");
    return;
  }

  clearConfig();
  console.log("Logged out successfully.");
}

export async function status(): Promise<void> {
  const data = getAuthData();
  
  if (!data.isLoggedIn) {
    console.log("Not logged in.");
    console.log("Run 'ttt auth login' to authenticate.");
    return;
  }

  console.log("Logged in");
  console.log(`Organization: ${data.orgId}`);
  console.log(`Config file: ${data.configPath}`);
  console.log(`Token: ${data.maskedToken}`);
}

export interface AuthData {
  isLoggedIn: boolean;
  orgId?: string;
  configPath?: string;
  maskedToken?: string;
}

export function getAuthData(): AuthData {
  const config = loadConfig();

  if (!config.sessionToken || !config.orgId) {
    return { isLoggedIn: false };
  }

  const maskedToken = config.sessionToken.slice(0, 10) + "..." + config.sessionToken.slice(-10);
  
  return {
    isLoggedIn: true,
    orgId: config.orgId,
    configPath: getConfigPath(),
    maskedToken,
  };
}

export async function exportEnv(): Promise<void> {
  const config = loadConfig();

  if (!config.sessionToken || !config.orgId) {
    console.error("Not logged in. Run 'ttt auth login' first.");
    process.exit(1);
  }

  console.log(`export TTT_TOKEN="${config.sessionToken}"`);
  console.log(`export TTT_ORG_ID="${config.orgId}"`);
}
