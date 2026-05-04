-- Employee-cycle assignments: HR assigns specific employees to a review cycle.
-- On assignment the bot immediately prompts the employee to fill their self-review.
-- The quarterly summary is generated and sent to the manager only after the
-- employee completes their self-review (NOT by the scheduler beforehand).

CREATE TABLE IF NOT EXISTS employee_cycle_assignments (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  review_cycle_id INTEGER NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  assigned_by     INTEGER REFERENCES employees(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prompt_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(employee_id, review_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_eca_cycle    ON employee_cycle_assignments(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_eca_employee ON employee_cycle_assignments(employee_id);
