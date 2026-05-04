-- =====================================================================
-- Migration: Slack bot support
-- Run AFTER 03_bot_tables.sql
-- =====================================================================

-- Add slack_user_id to employees (nullable - not everyone is on Slack)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS slack_user_id VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_slack_user_id
  ON employees(slack_user_id)
  WHERE slack_user_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Slack DM channel cache.
-- When we open a DM with a user (via conversations.open), Slack gives us
-- a channel id we reuse. Cached here so we don't re-open every time.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slack_conversation_refs (
    id              SERIAL PRIMARY KEY,
    slack_user_id   VARCHAR(50) UNIQUE NOT NULL,
    channel_id      VARCHAR(50) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
