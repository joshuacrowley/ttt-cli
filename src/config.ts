import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface TttConfig {
  sessionToken?: string;
  orgId?: string;
  userId?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".ttt");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DAEMON_SOCKET = path.join(CONFIG_DIR, "daemon.sock");
const DAEMON_PID = path.join(CONFIG_DIR, "daemon.pid");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): TttConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    // Config file doesn't exist or is invalid, return empty config
  }
  return {};
}

export function saveConfig(config: TttConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

export function isLoggedIn(): boolean {
  const config = loadConfig();
  return !!config.sessionToken && !!config.orgId;
}

export function getDaemonSocketPath(): string {
  return DAEMON_SOCKET;
}

export function getDaemonPidPath(): string {
  return DAEMON_PID;
}
