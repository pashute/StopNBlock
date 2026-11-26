// Shared app constants and logger for content.js, background.js and popup.js.
// Loaded as a classic script (executeScript files / importScripts / script tag), so it is
// wrapped in an IIFE and exposed once on globalThis. Re-loading it does nothing.
(() => {
  if (globalThis.logger) return;

  const APP_NAME = "StopNBlock";
  const APP_VERSION = "1.0.9"; // manifest.json must carry the same number (Chrome requires it there)
  // Which severities print (IMPORTANT always prints):
  //   "ERROR" = IMPORTANT + ERROR
  //   "WARN"  = IMPORTANT + ERROR + WARN
  //   "DEBUG" = IMPORTANT + ERROR + WARN + DEBUG
  const LOG_LEVEL = "DEBUG";

  const RANK = { ERROR: 1, WARN: 2, DEBUG: 3 };

  // "2026.11.26 14:05"
  function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Returns "StopNBlock.file.function.line" of the code that called log() or logError().
  // Stack lines: [0] "Error", [1] callerLocation, [2] log/logError, [3] the logging call site.
  function callerLocation() {
    const site = ((new Error().stack || "").split("\n")[3]) || "";
    const match = site.match(/at (?:(.+?) \()?(?:.*[\/\\])?([^\/\\:]+)\.js:(\d+):\d+\)?\s*$/);
    if (!match) return `${APP_NAME}.unknown:0`;
    const [, func = "anonymous", file, line] = match;
    return `${APP_NAME}.${file}.${func}:${line}`;
  }

  function shown(severity) {
    if (severity === "IMPORTANT") return true;
    return RANK[severity] <= RANK[LOG_LEVEL];
  }

  // log("IMPORTANT" | "ERROR" | "WARN" | "DEBUG", message, ...details)
  function log(severity, message, ...details) {
    if (!shown(severity)) return;
    const text = `${timestamp()}  [${severity}] ${callerLocation()} ${message}`;
    if (severity === "ERROR") console.error(text, ...details);
    else if (severity === "WARN") console.warn(text, ...details);
    else console.log(text, ...details);
  }

  // For caught errors: the error line with the error details on the next line (console.error),
  // then an end marker (console.log). ERROR is shown at every LOG_LEVEL.
  function logError(message, error) {
    const text = `${timestamp()}  [ERROR] ${callerLocation()} ${message}`;
    const details = error?.stack || String(error);
    console.error(`${text}\n${details}`);
    console.log("--- end of error message ---");
  }

  globalThis.logger = { APP_NAME, APP_VERSION, log, logError };
})();
