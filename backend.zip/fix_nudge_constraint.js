require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Drop old constraint and add new one that includes checkin_period
    await client.query(`
      ALTER TABLE nudge_log
        DROP CONSTRAINT IF EXISTS nudge_log_stage_check;
    `);
    await client.query(`
      ALTER TABLE nudge_log
        ADD CONSTRAINT nudge_log_stage_check
        CHECK (stage IN ('employee','manager','delivery_head','hr','checkin_period'));
    `);
    console.log('Constraint updated — checkin_period is now a valid stage.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
