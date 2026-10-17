//establishes a connection to the MySQL database using the mysql2 library and creates a connection pool for efficient database operations. The connection parameters are retrieved from environment variables, allowing for flexibility in different deployment environments. The pool is then exported for use in other parts of the application.

const mysql = require("mysql2/promise");

// [FIX #8 - SSL] Pehle hamesha `rejectUnauthorized: false` tha, matlab server ka certificate verify hi nahi hota tha (insecure).
// Ab agar .env me DB_SSL_CA set hai (Aiven ka CA certificate ka text, ya "\n" wali single line), to proper verification hoga.
// Agar DB_SSL_CA nahi diya to purane jaisa hi chalega taaki app na toote -- bas ek warning console me dikhegi.
// Aiven console se "CA certificate" download karke uska content DB_SSL_CA me daal do to ye secure ho jayega.
let sslConfig;
if (process.env.DB_SSL_CA) {
  sslConfig = {
    ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n"),
    rejectUnauthorized: true,
  };
} else {
  console.warn(
    "DB_SSL_CA set nahi hai: SSL certificate verify nahi hoga (insecure). .env me Aiven ka CA certificate daalo.",
  );
  sslConfig = { rejectUnauthorized: false };
}

// Create a connection pool to the MySQL database, helps in concurrent connections and efficient resource management, better than creating a new connection for each request which is done by mysql.createConnection() method. It is basically pool of connections for the user.

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  ssl: sslConfig,
});

module.exports = pool;
