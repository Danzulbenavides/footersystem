const { Pool } = require("pg");
require("dotenv").config();

// =====================================================
// POSTGRESQL CONNECTION POOL
// =====================================================

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,

  // ---------------------------------------------------
  // Maximum number of PostgreSQL connections that can
  // be active at the same time.
  // Default: 10
  // ---------------------------------------------------

  max: Number(process.env.DB_POOL_MAX || 10),

  // ---------------------------------------------------
  // Close idle connections after 30 seconds.
  // ---------------------------------------------------

  idleTimeoutMillis: 30_000,

  // ---------------------------------------------------
  // Stop waiting for a database connection after
  // 5 seconds.
  // ---------------------------------------------------

  connectionTimeoutMillis: 5_000,
});

// =====================================================
// HANDLE UNEXPECTED POOL ERRORS
// =====================================================

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

// =====================================================
// EXPORT DATABASE POOL
// =====================================================

module.exports = pool;
