const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL; sslmode=require in URL handles most cases,
  // but explicitly allowing self-signed keeps local/dev resilient.
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

/**
 * Thin wrapper so routes can do: await db.query('SELECT ...', [params])
 */
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
