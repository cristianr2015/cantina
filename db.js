const mysql = require('mysql2/promise');

const useTls = process.env.DB_SSL === 'true';
const tlsCa = process.env.DB_SSL_CA_BASE64
  ? Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8')
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cantina_db',
  ssl: useTls ? { ca: tlsCa, rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
});

module.exports = pool;
