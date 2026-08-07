//establishes a connection to the MySQL database using the mysql2 library and creates a connection pool for efficient database operations. The connection parameters are retrieved from environment variables, allowing for flexibility in different deployment environments. The pool is then exported for use in other parts of the application.

const mysql = require("mysql2/promise");

// Create a connection pool to the MySQL database, helps in concurrent connections and efficient resource management, better than creating a new connection for each request which is done by mysql.createConnection() method. It is basically pool of connections for the user.

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
});

module.exports = pool;
