-- ── Migration 08: Goal templates, employee goals, scoring, annual reviews ──────

-- 1. Goal templates (HR-defined, per role)
CREATE TABLE IF NOT EXISTS goal_templates (
  id               SERIAL PRIMARY KEY,
  role_name        VARCHAR(100) NOT NULL,
  objective_type   VARCHAR(50)  NOT NULL,   -- Financial | Customer Focus | Business Processes | People Related | Values
  area             VARCHAR(100) NOT NULL,
  commitment       VARCHAR(200) NOT NULL,
  weightage        NUMERIC(6,2),            -- NULL for Values rows (no weightage)
  kra_title        TEXT         NOT NULL,
  goal_description TEXT,
  goal_type        VARCHAR(30)  NOT NULL
                   CHECK (goal_type IN ('Numerical','Met or Not Met','Feedback')),
  goal_performance VARCHAR(50)  NOT NULL DEFAULT 'The higher the better',
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_tmpl_role ON goal_templates (role_name);
CREATE INDEX IF NOT EXISTS idx_goal_tmpl_type ON goal_templates (objective_type);

-- 2. Employee goals (employee selects subset from template; non-Values weightages must sum to 100)
CREATE TABLE IF NOT EXISTS employee_goals (
  id               SERIAL PRIMARY KEY,
  cycle_id         INTEGER      NOT NULL REFERENCES review_cycles(id)    ON DELETE CASCADE,
  employee_id      INTEGER      NOT NULL REFERENCES employees(id),
  template_id      INTEGER               REFERENCES goal_templates(id),  -- NULL if custom goal
  objective_type   VARCHAR(50)  NOT NULL,
  area             VARCHAR(100),
  commitment       VARCHAR(200),
  weightage        NUMERIC(6,2),            -- NULL for Values; selected rows must sum to 100
  kra_title        TEXT         NOT NULL,
  goal_description TEXT,
  goal_type        VARCHAR(30)  NOT NULL
                   CHECK (goal_type IN ('Numerical','Met or Not Met','Feedback')),
  goal_performance VARCHAR(50)  NOT NULL DEFAULT 'The higher the better',
  target_value     TEXT,                    -- employee sets their specific target
  checkin_type     VARCHAR(30),             -- weekly | sprint | monthly | quarterly (per goal)
  status           VARCHAR(30)  NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','manager_approved',
                                     'changes_requested','rejected','hr_locked')),
  manager_comment  TEXT,
  hr_comment       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, employee_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_goals_cycle ON employee_goals (cycle_id);
CREATE INDEX IF NOT EXISTS idx_emp_goals_emp   ON employee_goals (employee_id);

-- 3. Goal approval audit log
CREATE TABLE IF NOT EXISTS goal_approval_log (
  id          SERIAL PRIMARY KEY,
  cycle_id    INTEGER     NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id INTEGER     NOT NULL REFERENCES employees(id),
  actor_id    INTEGER              REFERENCES employees(id),
  action      VARCHAR(50) NOT NULL,
  -- submitted | manager_approved | changes_requested | rejected | hr_locked
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gal_cycle ON goal_approval_log (cycle_id, employee_id);

-- 4. Check-in scores (auto-calculated per goal per period)
CREATE TABLE IF NOT EXISTS checkin_scores (
  id             SERIAL PRIMARY KEY,
  period_id      INTEGER      NOT NULL REFERENCES checkin_periods(id) ON DELETE CASCADE,
  employee_id    INTEGER      NOT NULL REFERENCES employees(id),
  goal_id        INTEGER      NOT NULL REFERENCES employee_goals(id)  ON DELETE CASCADE,
  raw_score      NUMERIC(6,2),             -- value employee entered (or 0 if auto-locked)
  weighted_score NUMERIC(6,2),             -- raw_score * (weightage / 100)
  is_locked      BOOLEAN      NOT NULL DEFAULT FALSE,
  zero_flagged   BOOLEAN      NOT NULL DEFAULT FALSE,  -- missed deadline, flagged to manager
  scored_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, employee_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_period ON checkin_scores (period_id);
CREATE INDEX IF NOT EXISTS idx_scores_emp    ON checkin_scores (employee_id);

-- 5. Annual reviews (aggregated from 4 quarterly reviews)
CREATE TABLE IF NOT EXISTS annual_reviews (
  id                 SERIAL PRIMARY KEY,
  cycle_id           INTEGER     NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id        INTEGER     NOT NULL REFERENCES employees(id),
  full_year_score    NUMERIC(5,2),
  performance_band   VARCHAR(30),
  -- Outstanding | Exceeds Expectations | Meets Expectations | Below Expectations | NI
  ai_narrative       TEXT,
  strengths          TEXT,
  development_areas  TEXT,
  recommended_action TEXT,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_annual_cycle ON annual_reviews (cycle_id);
CREATE INDEX IF NOT EXISTS idx_annual_emp   ON annual_reviews (employee_id);

-- 6. Competency evaluations (manager rates employee on 6 dimensions during annual review)
CREATE TABLE IF NOT EXISTS competency_evaluations (
  id                  SERIAL PRIMARY KEY,
  annual_review_id    INTEGER      NOT NULL REFERENCES annual_reviews(id) ON DELETE CASCADE,
  manager_id          INTEGER      NOT NULL REFERENCES employees(id),
  delivery_score      NUMERIC(4,2),
  technical_score     NUMERIC(4,2),
  collaboration_score NUMERIC(4,2),
  communication_score NUMERIC(4,2),
  leadership_score    NUMERIC(4,2),
  values_score        NUMERIC(4,2),
  overall_comment     TEXT         NOT NULL,
  submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (annual_review_id)
);

-- 7. Alter existing tables

-- Link checkin_responses to a specific employee goal
ALTER TABLE checkin_responses
  ADD COLUMN IF NOT EXISTS goal_id INTEGER REFERENCES employee_goals(id);

-- Track goal-setting lifecycle on assignments
ALTER TABLE employee_cycle_assignments
  ADD COLUMN IF NOT EXISTS goals_status VARCHAR(30) NOT NULL DEFAULT 'not_started'
  CHECK (goals_status IN ('not_started','draft','submitted',
                          'manager_approved','changes_requested','hr_locked'));

-- Add scoring + band fields to quarterly_reviews
ALTER TABLE quarterly_reviews
  ADD COLUMN IF NOT EXISTS overall_score           NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS performance_band        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS employee_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_score_override  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS manager_feedback_due    DATE;

-- Add return-to-manager support for delivery_head_reviews
ALTER TABLE delivery_head_reviews
  ADD COLUMN IF NOT EXISTS status        VARCHAR(30) NOT NULL DEFAULT 'approved'
  CHECK (status IN ('approved','returned')),
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS due_date      DATE;
