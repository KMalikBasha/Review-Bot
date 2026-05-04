-- ── Migration 06: CheckIn types, check-in periods, quarterly reviews ──────────

-- 1. Add checkin_type to review_cycles
ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS checkin_type VARCHAR(20) NOT NULL DEFAULT 'quarterly';

-- Values: per_sprint | monthly | quarterly | mid_year | yearly
-- per_sprint  = 2-week sprints
-- monthly     = one check-in per calendar month
-- quarterly   = one check-in per quarter (Q1-Q4)
-- mid_year    = two check-ins per year (H1, H2)
-- yearly      = one annual check-in

-- 2. Check-in periods (auto-generated when cycle becomes active)
CREATE TABLE IF NOT EXISTS checkin_periods (
  id              SERIAL PRIMARY KEY,
  review_cycle_id INTEGER      NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  period_number   INTEGER      NOT NULL,
  period_label    VARCHAR(100) NOT NULL,  -- e.g. "Sprint 3", "March 2026", "Q1 2026"
  period_start    DATE         NOT NULL,
  period_end      DATE         NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'upcoming',
  -- upcoming | active | closed
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (review_cycle_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_checkin_periods_cycle  ON checkin_periods (review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_checkin_periods_status ON checkin_periods (status);

-- 3. Employee check-in responses (one per question per period)
CREATE TABLE IF NOT EXISTS checkin_responses (
  id                SERIAL PRIMARY KEY,
  checkin_period_id INTEGER     NOT NULL REFERENCES checkin_periods(id) ON DELETE CASCADE,
  employee_id       INTEGER     NOT NULL REFERENCES employees(id),
  question_id       INTEGER     NOT NULL REFERENCES questionnaires(id),
  response_text     TEXT        NOT NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checkin_period_id, employee_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_resp_period ON checkin_responses (checkin_period_id);
CREATE INDEX IF NOT EXISTS idx_checkin_resp_emp    ON checkin_responses (employee_id);

-- 4. Quarterly manager reviews (auto-generated; manager adds notes)
CREATE TABLE IF NOT EXISTS quarterly_reviews (
  id              SERIAL PRIMARY KEY,
  review_cycle_id INTEGER     NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id     INTEGER     NOT NULL REFERENCES employees(id),
  quarter_label   VARCHAR(50) NOT NULL,   -- e.g. "Q1 2026"
  quarter_start   DATE        NOT NULL,
  quarter_end     DATE        NOT NULL,
  checkin_count   INTEGER     NOT NULL DEFAULT 0,
  ai_summary      TEXT,                   -- AI-generated summary of all check-ins in the quarter
  manager_notes   TEXT,                   -- Manager's written feedback
  manager_id      INTEGER     REFERENCES employees(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | submitted
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_cycle_id, employee_id, quarter_label)
);

CREATE INDEX IF NOT EXISTS idx_qrev_cycle  ON quarterly_reviews (review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_qrev_emp    ON quarterly_reviews (employee_id);
CREATE INDEX IF NOT EXISTS idx_qrev_status ON quarterly_reviews (status);
