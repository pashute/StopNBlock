// Shared logging helpers for content.js and background.js.
// Loaded as a classic script (executeScript files / importScripts), so it is wrapped
// in an IIFE and exposed once on globalThis. Re-loading it does nothing.
(() => {
  if (globalThis.StopNBlockLog) return;

  const LOG_LEVEL = "debug"; // "debug" = all messages, "warnings" = only warnings and errors

  // "2026.11.26 14:05"
  function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Finds "file:func:line" of the code that called debugLog/warnLog.
  // Stack lines: [0] "Error", [1] callerLocation, [2] debugLog/warnLog, [3] the logging call site.
  function callerLocation() {
    const site = ((new Error().stack || "").split("\n")[3]) || "";
    const match = site.match(/at (?:(.+?) \()?(?:.*[\/\\])?([^\/\\:]+\.js):(\d+):\d+\)?\s*$/);
    if (!match) return "unknown:unknown:0";
    const [, func = "anonymous", file, line] = match;
    return `${file}:${func}:${line}`;
  }

  // Prints only when LOG_LEVEL is "debug".
  function debugLog(message, ...details) {
    if (LOG_LEVEL !== "debug") return;
    console.log(`${timestamp()} ${callerLocation()} ${message}`, ...details);
  }

  // Prints at both levels.
  function warnLog(message, ...details) {
    console.warn(`${timestamp()} ${callerLocation()} ${message}`, ...details);
  }

  globalThis.StopNBlockLog = { debugLog, warnLog };
})();
