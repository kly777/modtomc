/**
 * 前端日志工具：同时输出到浏览器 console 并发送到后端 ./log/frontend.log
 */
const LOG_URL = "http://localhost:8080/api/log";

async function sendLog(level: string, ...args: unknown[]) {
  const message = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");

  // 同时输出到浏览器控制台
  const consoleFn = (console as unknown as Record<string, (...a: unknown[]) => void>)[level.toLowerCase()] ?? console.log;
  consoleFn(`[${level}] ${message}`);

  // 异步发送到后端（不阻塞）
  try {
    await fetch(LOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message }),
      keepalive: true,
    });
  } catch {
    // 后端不可用时静默失败
  }
}

export const logger = {
  debug: (...args: unknown[]) => sendLog("DEBUG", ...args),
  info: (...args: unknown[]) => sendLog("INFO", ...args),
  warn: (...args: unknown[]) => sendLog("WARN", ...args),
  error: (...args: unknown[]) => sendLog("ERROR", ...args),
};
