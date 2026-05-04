-- =====================================================================
-- Migration: Conversation flow sessions
-- Tracks where a user is inside a multi-step bot conversation.
-- Run AFTER 04_slack_support.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS flow_sessions (
    id              SERIAL PRIMARY KEY,
    -- who
    employee_id     INT NOT NULL REFERENCES employees(id),
    role            VARCHAR(30) NOT NULL
                    CHECK (role IN ('employee','manager','delivery_head','hr')),
    -- what they're reviewing
    review_cycle_id INT NOT NULL REFERENCES review_cycles(id),
    target_employee_id INT REFERENCES employees(id),  -- employee being reviewed (null for 'employee' role)
    -- state machine
    step            VARCHAR(50) NOT NULL,  -- e.g. 'choose_mode', 'ask_question', 'collect_feedback', 'confirm'
    state           JSONB NOT NULL DEFAULT '{}'::jsonb, -- { mode, current_q_idx, answers:{} , ... }
    -- channel metadata
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('slack','teams')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- A user can only have one ACTIVE session per (cycle, role, targetEmployee).
-- We treat the latest row as "current" and delete on completion.
CREATE INDEX IF NOT EXISTS idx_flow_sessions_lookup
  ON flow_sessions(employee_id, channel);
