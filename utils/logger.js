// [LOGGING] Small logger with no extra dependencies.
//
// Every log line looks like:
//   2026-11-23T14:05:12.345Z INFO  Server started {"port":3000}
//
// Where logs go:
//   - Always to the console (stdout / stderr). On Render this is what shows up in the "Logs" tab.
//     Render's disk is wiped on every deploy / restart, so a log FILE there would be lost exactly when
//     you need it most. The console is the reliable place in production.
//   - Also to a file when LOG_FILE is set in .env (e.g. LOG_FILE=logs/app.log).
//     Locally (NODE_ENV !== "production") it defaults to logs/app.log so you can open it any time.
//
// Never log passwords, session cookies, CSRF tokens or full request bodies.

const fs = require("fs");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";
const logFilePath = process.env.LOG_FILE || (isProduction ? null : "logs/app.log");

let fileStream = null;
if (logFilePath) {
  try {
    const absolutePath = path.resolve(__dirname, "..", logFilePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fileStream = fs.createWriteStream(absolutePath, { flags: "a" }); // "a" = append, keep old logs
    fileStream.on("error", (error) => {
      console.error("Log file write failed, continuing with console only:", error.message);
      fileStream = null;
    });
  } catch (error) {
    console.error("Could not open log file, continuing with console only:", error.message);
  }
}

function formatMeta(meta) {
  if (!meta) return "";
  if (meta instanceof Error) meta = { error: meta };
  const plain = {};
  for (const [key, value] of Object.entries(meta)) {
    // Errors don't turn into JSON on their own, so copy the useful parts out
    plain[key] = value instanceof Error ? { message: value.message, code: value.code, stack: value.stack } : value;
  }
  return " " + JSON.stringify(plain);
}

function write(level, message, meta) {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}${formatMeta(meta)}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
  if (fileStream) fileStream.write(line + "\n");
}

module.exports = {
  info: (message, meta) => write("INFO", message, meta),
  warn: (message, meta) => write("WARN", message, meta),
  error: (message, meta) => write("ERROR", message, meta),
};
