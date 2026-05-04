-- =====================================================================
-- Appraisal Bot - Postgres Schema
-- =====================================================================

-- Clean slate (safe for dev; remove in prod)
DROP TABLE IF EXISTS final_summaries CASCADE;
DROP TABLE IF EXISTS delivery_head_reviews CASCADE;
DROP TABLE IF EXISTS manager_feedback CASCADE;
DROP TABLE IF EXISTS employee_responses CASCADE;
DROP TABLE IF EXISTS review_cycles CASCADE;
DROP TABLE IF EXISTS questionnaires CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS employee_categories CASCADE;

-- ---------------------------------------------------------------------
-- 1. Employee categories (developer, qa, admin, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE employee_categories (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) UNIQUE NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. Employees (includes managers, delivery heads, HR - role-based)
-- ---------------------------------------------------------------------
CREATE TABLE employees (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    email            VARCHAR(200) UNIQUE NOT NULL,
    teams_user_id    VARCHAR(200) UNIQUE,   -- MS Teams AAD object id
    category_id      INT REFERENCES employee_categories(id),
    role             VARCHAR(50) NOT NULL CHECK (role IN ('employee','manager','delivery_head','hr')),
    manager_id       INT REFERENCES employees(id),
    delivery_head_id INT REFERENCES employees(id),
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. Questionnaires (per-category questions)
-- ---------------------------------------------------------------------
CREATE TABLE questionnaires (
    id             SERIAL PRIMARY KEY,
    category_id    INT NOT NULL REFERENCES employee_categories(id),
    question_order INT NOT NULL,
    question_text  TEXT NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (category_id, question_order)
);

-- ---------------------------------------------------------------------
-- 4. Review cycles (one per appraisal round; owns the interval config)
-- ---------------------------------------------------------------------
CREATE TABLE review_cycles (
    id                                 SERIAL PRIMARY KEY,
    name                               VARCHAR(200) NOT NULL,
    start_date                         DATE NOT NULL,
    end_date                           DATE NOT NULL,
    employee_notify_interval_days      INT NOT NULL DEFAULT 7,
    manager_notify_interval_days       INT NOT NULL DEFAULT 7,
    delivery_head_notify_interval_days INT NOT NULL DEFAULT 7,
    status                             VARCHAR(30) DEFAULT 'draft'
                                       CHECK (status IN ('draft','active','completed','cancelled')),
    created_by                         INT REFERENCES employees(id),
    created_at                         TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 5. Employee responses (raw answers to questionnaire)
-- ---------------------------------------------------------------------
CREATE TABLE employee_responses (
    id               SERIAL PRIMARY KEY,
    review_cycle_id  INT NOT NULL REFERENCES review_cycles(id),
    employee_id      INT NOT NULL REFERENCES employees(id),
    questionnaire_id INT NOT NULL REFERENCES questionnaires(id),
    response_text    TEXT NOT NULL,
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_cycle_id, employee_id, questionnaire_id)
);

-- ---------------------------------------------------------------------
-- 6. Manager feedback (AI summary of employee + manager's feedback)
-- ---------------------------------------------------------------------
CREATE TABLE manager_feedback (
    id              SERIAL PRIMARY KEY,
    review_cycle_id INT NOT NULL REFERENCES review_cycles(id),
    employee_id     INT NOT NULL REFERENCES employees(id),
    manager_id      INT NOT NULL REFERENCES employees(id),
    ai_summary      TEXT,                 -- AI summary of employee responses
    feedback_text   TEXT NOT NULL,        -- manager's actual feedback
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_cycle_id, employee_id)
);

-- ---------------------------------------------------------------------
-- 7. Delivery head review (AI summary of employee+manager + DH review)
-- ---------------------------------------------------------------------
CREATE TABLE delivery_head_reviews (
    id               SERIAL PRIMARY KEY,
    review_cycle_id  INT NOT NULL REFERENCES review_cycles(id),
    employee_id      INT NOT NULL REFERENCES employees(id),
    delivery_head_id INT NOT NULL REFERENCES employees(id),
    ai_summary       TEXT,                 -- AI summary of employee + manager feedback
    review_text      TEXT NOT NULL,        -- DH's actual review
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_cycle_id, employee_id)
);

-- ---------------------------------------------------------------------
-- 8. Final summary by HR (AI summary of all stages + HR's final word)
-- ---------------------------------------------------------------------
CREATE TABLE final_summaries (
    id              SERIAL PRIMARY KEY,
    review_cycle_id INT NOT NULL REFERENCES review_cycles(id),
    employee_id     INT NOT NULL REFERENCES employees(id),
    hr_id           INT NOT NULL REFERENCES employees(id),
    ai_summary      TEXT,                 -- AI summary of employee + manager + DH
    final_summary   TEXT NOT NULL,        -- HR's finalized summary
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_cycle_id, employee_id)
);

-- ---------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------
CREATE INDEX idx_employees_manager       ON employees(manager_id);
CREATE INDEX idx_employees_delivery_head ON employees(delivery_head_id);
CREATE INDEX idx_responses_cycle_emp     ON employee_responses(review_cycle_id, employee_id);
CREATE INDEX idx_mgr_fb_cycle            ON manager_feedback(review_cycle_id);
CREATE INDEX idx_dh_rev_cycle            ON delivery_head_reviews(review_cycle_id);
CREATE INDEX idx_final_cycle             ON final_summaries(review_cycle_id);
