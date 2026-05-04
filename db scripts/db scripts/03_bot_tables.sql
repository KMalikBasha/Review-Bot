-- =====================================================================
-- Migration: bot support tables
-- Run AFTER schema.sql + seed.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Teams conversation references per user
-- Captured when a user first messages the bot (or is added to a team).
-- Needed to "proactively" send nudges.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_conversation_refs (
    id               SERIAL PRIMARY KEY,
    teams_user_id    VARCHAR(200) UNIQUE NOT NULL,
    conversation_ref JSONB NOT NULL,       -- full ConversationReference object
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Nudge log - records each nudge sent so we can rate-limit
-- (don't re-nudge same person for same cycle/stage within interval)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nudge_log (
    id              SERIAL PRIMARY KEY,
    review_cycle_id INT NOT NULL REFERENCES review_cycles(id),
    employee_id     INT NOT NULL REFERENCES employees(id),
    stage           VARCHAR(30) NOT NULL
                    CHECK (stage IN ('employee','manager','delivery_head','hr')),
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    delivered       BOOLEAN DEFAULT TRUE,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_nudge_log_lookup
  ON nudge_log(review_cycle_id, employee_id, stage, sent_at DESC);
