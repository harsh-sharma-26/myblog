const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
});

module.exports = pool;
