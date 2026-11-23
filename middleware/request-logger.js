// [LOGGING] Logs one line per request once the response is sent:
//   2026-11-23T14:05:12.345Z INFO  GET /posts 200 42ms {"user":"user#3"}
// 5xx responses are logged as ERROR and 4xx as WARN, so problems are easy to search for.
// Mounted AFTER express.static in app.js, so CSS / JS / image requests are not logged (too noisy).

const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const auth = req.session && req.session.auth;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`;
    const meta = { ip: req.ip, user: auth ? `${auth.type}#${auth.id}` : "guest" };

    if (res.statusCode >= 500) logger.error(message, meta);
    else if (res.statusCode >= 400) logger.warn(message, meta);
    else logger.info(message, meta);
  });

  next();
}

module.exports = { requestLogger };
