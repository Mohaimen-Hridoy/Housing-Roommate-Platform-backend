import { env } from "../config";

type Level = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
const levelOrder: Record<Level, number> = { fatal: 10, error: 20, warn: 30, info: 40, debug: 50, trace: 60 };
const current = levelOrder[env.logLevel] ?? levelOrder.info;

function log(level: Level, message: string, ...args: unknown[]) {
  if (levelOrder[level] > current) return;
  const ts = new Date().toISOString();
  const prefix = env.isDev ? `\x1b[36m[${ts}][${level}]\x1b[0m` : `[${ts}][${level}]`;
    console[level === "fatal" ? "error" : level === "warn" ? "warn" : "log"](prefix, message, ...args);
}

export const logger = {
  fatal: (m: string, ...a: unknown[]) => log("fatal", m, ...a),
  error: (m: string, ...a: unknown[]) => log("error", m, ...a),
  warn: (m: string, ...a: unknown[]) => log("warn", m, ...a),
  info: (m: string, ...a: unknown[]) => log("info", m, ...a),
  debug: (m: string, ...a: unknown[]) => log("debug", m, ...a),
  trace: (m: string, ...a: unknown[]) => log("trace", m, ...a),
};
