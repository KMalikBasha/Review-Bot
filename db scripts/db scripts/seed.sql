-- =====================================================================
-- Appraisal Bot - Seed / Test Data
-- Run AFTER schema.sql
--
-- Re-runnable: wipes all existing data and re-inserts from scratch.
-- Use this as a backup to refresh the DB to a known seeded state.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Wipe all existing data (order respects FKs; RESTART IDENTITY resets serials)
-- ---------------------------------------------------------------------
TRUNCATE TABLE
  final_summaries,
  delivery_head_reviews,
  manager_feedback,
  employee_responses,
  review_cycles,
  questionnaires,
  employees,
  employee_categories
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Employee categories
-- ---------------------------------------------------------------------
INSERT INTO employee_categories (name, description) VALUES
  ('developer', 'Software engineers across backend, frontend, full-stack'),
  ('qa',        'Quality assurance engineers - manual & automation'),
  ('admin',     'Administrative & office support staff'),
  ('accounts',  'Finance and accounting team');

-- ---------------------------------------------------------------------
-- Employees (seeded in layers due to self-referencing FKs)
-- Layer 1: HR & Delivery Head (no manager/DH above them)
-- ---------------------------------------------------------------------
INSERT INTO employees (name, email, teams_user_id, category_id, role, manager_id, delivery_head_id) VALUES
  ('Priya HR',      'priya.hr@example.com',      'teams-priya-001',  NULL, 'hr',             NULL, NULL),
  ('Rahul Delivery','rahul.delivery@example.com','teams-rahul-002',  NULL, 'delivery_head',  NULL, NULL);

-- Layer 2: Managers (report to delivery head)
INSERT INTO employees (name, email, teams_user_id, category_id, role, manager_id, delivery_head_id) VALUES
  ('Anita Manager', 'anita.mgr@example.com', 'teams-anita-003', 1, 'manager', NULL, 2),
  ('Vikram Manager','vikram.mgr@example.com','teams-vikram-004',2, 'manager', NULL, 2);

-- Layer 3: Employees (report to managers)
INSERT INTO employees (name, email, teams_user_id, category_id, role, manager_id, delivery_head_id) VALUES
  ('Arjun Dev',   'arjun.dev@example.com',   'teams-arjun-005',   1, 'employee', 3, 2),
  ('Sneha Dev',   'sneha.dev@example.com',   'teams-sneha-006',   1, 'employee', 3, 2),
  ('Karthik QA',  'karthik.qa@example.com',  'teams-karthik-007', 2, 'employee', 4, 2),
  ('Meera QA',    'meera.qa@example.com',    'teams-meera-008',   2, 'employee', 4, 2),
  ('Ravi Admin',  'ravi.admin@example.com',  'teams-ravi-009',    3, 'employee', 3, 2),
  ('Lakshmi Acc', 'lakshmi.acc@example.com', 'teams-lakshmi-010', 4, 'employee', 4, 2);

-- ---------------------------------------------------------------------
-- Questionnaires (per category)
-- ---------------------------------------------------------------------
-- Developer questions
INSERT INTO questionnaires (category_id, question_order, question_text) VALUES
  (1, 1, 'What were your key technical achievements this review period?'),
  (1, 2, 'Describe a challenging bug or system issue you solved and how.'),
  (1, 3, 'What new technologies, frameworks, or skills did you learn?'),
  (1, 4, 'How did you contribute to code reviews and team knowledge sharing?'),
  (1, 5, 'What are your technical growth goals for the next cycle?');

-- QA questions
INSERT INTO questionnaires (category_id, question_order, question_text) VALUES
  (2, 1, 'What were the most critical defects you caught this cycle?'),
  (2, 2, 'How did you improve test coverage or automation?'),
  (2, 3, 'Describe your collaboration with developers on quality issues.'),
  (2, 4, 'What testing tools or techniques did you adopt or master?'),
  (2, 5, 'What are your QA process improvement ideas for next cycle?');

-- Admin questions
INSERT INTO questionnaires (category_id, question_order, question_text) VALUES
  (3, 1, 'What administrative processes did you improve or streamline?'),
  (3, 2, 'Describe how you supported cross-functional team needs.'),
  (3, 3, 'What challenges did you face in office operations and how did you handle them?'),
  (3, 4, 'What are your goals for improving office efficiency next cycle?');

-- Accounts questions
INSERT INTO questionnaires (category_id, question_order, question_text) VALUES
  (4, 1, 'Describe your key contributions to monthly/quarterly financial closes.'),
  (4, 2, 'What compliance or audit-related work did you handle?'),
  (4, 3, 'How did you improve accuracy or reduce turnaround in your work?'),
  (4, 4, 'What new tools or accounting practices did you adopt?'),
  (4, 5, 'What are your professional growth goals for next cycle?');

-- ---------------------------------------------------------------------
-- A sample review cycle
-- ---------------------------------------------------------------------
INSERT INTO review_cycles
  (name, start_date, end_date,
   employee_notify_interval_days, manager_notify_interval_days, delivery_head_notify_interval_days,
   status, created_by)
VALUES
  ('Q2 2026 Appraisal', '2026-04-01', '2026-05-15', 7, 5, 5, 'active', 1);

-- ---------------------------------------------------------------------
-- Sample employee responses (Arjun - employee id 5, questions 1-5)
-- Just for testing downstream flows
-- ---------------------------------------------------------------------
INSERT INTO employee_responses (review_cycle_id, employee_id, questionnaire_id, response_text) VALUES
  (1, 5, 1, 'Led the migration of the payments service from REST to gRPC, reducing p95 latency by 40%.'),
  (1, 5, 2, 'Debugged an intermittent race condition in the order queue using distributed tracing and fixed it with a proper mutex.'),
  (1, 5, 3, 'Learned Rust fundamentals and built a small internal CLI tool for log parsing.'),
  (1, 5, 4, 'Reviewed ~120 PRs this cycle and ran two brown-bag sessions on gRPC.'),
  (1, 5, 5, 'Go deeper into system design and start mentoring juniors on distributed systems.');

-- =====================================================================
-- HISTORICAL CYCLE: Q1 2026 Appraisal (completed)
-- Full stakeholder responses for 2 employees:
--   - Arjun Dev   (id 5, developer, manager=Anita id 3, DH=Rahul id 2)
--   - Karthik QA  (id 7, qa,        manager=Vikram id 4, DH=Rahul id 2)
-- HR = Priya (id 1)
-- =====================================================================

-- Historical review cycle (cycle_id = 2)
INSERT INTO review_cycles
  (name, start_date, end_date,
   employee_notify_interval_days, manager_notify_interval_days, delivery_head_notify_interval_days,
   status, created_by)
VALUES
  ('Q1 2026 Appraisal', '2026-01-01', '2026-02-15', 7, 5, 5, 'completed', 1);

-- ---------------------------------------------------------------------
-- Employee responses - Arjun (developer, id 5) - questions 1-5
-- ---------------------------------------------------------------------
INSERT INTO employee_responses (review_cycle_id, employee_id, questionnaire_id, response_text, submitted_at) VALUES
  (2, 5, 1, 'Delivered the new notification microservice from scratch — handled 2M+ events/day in prod within 6 weeks of launch.', '2026-01-12 10:30:00+05:30'),
  (2, 5, 2, 'Diagnosed a memory leak in the billing worker caused by unbounded cache growth; implemented LRU eviction and cut memory use by 60%.', '2026-01-12 10:35:00+05:30'),
  (2, 5, 3, 'Picked up Kubernetes operators and wrote our first custom controller for automated DB backup scheduling.', '2026-01-12 10:40:00+05:30'),
  (2, 5, 4, 'Was the top PR reviewer in the team (~95 reviews) and onboarded 2 new joiners in the platform team.', '2026-01-12 10:45:00+05:30'),
  (2, 5, 5, 'Want to grow toward a tech lead role — more ownership on architecture decisions and cross-team initiatives.', '2026-01-12 10:50:00+05:30');

-- ---------------------------------------------------------------------
-- Employee responses - Karthik (qa, id 7) - questions 6-10
-- ---------------------------------------------------------------------
INSERT INTO employee_responses (review_cycle_id, employee_id, questionnaire_id, response_text, submitted_at) VALUES
  (2, 7, 6,  'Caught a critical pre-prod issue in the payment reconciliation flow that would have caused double-charges — saved a potential incident.', '2026-01-14 14:10:00+05:30'),
  (2, 7, 7,  'Grew Cypress e2e suite from 40 to 180 tests; integrated it into CI with parallel runs, cutting nightly regression from 3h to 35m.', '2026-01-14 14:15:00+05:30'),
  (2, 7, 8,  'Paired closely with devs on shift-left testing — ran weekly "bug bash" sessions with the backend team.', '2026-01-14 14:20:00+05:30'),
  (2, 7, 9,  'Adopted Playwright for a new internal tool and evaluated k6 for load testing; drafted a proposal for team-wide adoption.', '2026-01-14 14:25:00+05:30'),
  (2, 7, 10, 'Want to formalize a test strategy doc per service and push for contract testing between microservices.', '2026-01-14 14:30:00+05:30');

-- ---------------------------------------------------------------------
-- Manager feedback
-- ---------------------------------------------------------------------
INSERT INTO manager_feedback (review_cycle_id, employee_id, manager_id, ai_summary, feedback_text, submitted_at) VALUES
  (2, 5, 3,
   'Arjun delivered a high-impact notification microservice handling 2M+ events/day, resolved a significant memory leak in billing (-60% memory), picked up Kubernetes operators, led PR reviews, and mentored new joiners. Stated growth goal: move toward a tech lead role with more architectural ownership.',
   'Arjun had a strong cycle. The notification service launch was clean and he handled prod issues calmly. Memory leak fix was a great example of ownership. Recommending him for tech lead track — next step is to get him leading a cross-team initiative. Area to improve: documentation could be more thorough, especially for the new service.',
   '2026-01-25 11:00:00+05:30'),
  (2, 7, 4,
   'Karthik caught a critical payment reconciliation bug pre-prod, expanded Cypress suite 4.5x and cut regression time from 3h to 35m, drove shift-left via bug bashes, and evaluated Playwright + k6. Wants to formalize test strategy docs and introduce contract testing.',
   'Karthik is becoming the quality backbone of the QA team. The Cypress improvements alone saved the team significant engineering hours. His proactive bug bashes have visibly improved dev-QA collaboration. Ready for senior QA engineer promotion this cycle. Area to grow: needs to start mentoring junior QAs more actively.',
   '2026-01-27 15:30:00+05:30');

-- ---------------------------------------------------------------------
-- Delivery head reviews
-- ---------------------------------------------------------------------
INSERT INTO delivery_head_reviews (review_cycle_id, employee_id, delivery_head_id, ai_summary, review_text, submitted_at) VALUES
  (2, 5, 2,
   'Employee (Arjun): delivered notification microservice (2M+ events/day), fixed billing memory leak, learned K8s operators, top PR reviewer, mentored juniors. Manager (Anita): strong cycle, recommends tech lead track; wants improved documentation.',
   'Endorse the tech lead track recommendation. Arjun has demonstrated consistent technical depth and team impact over the last two cycles. I would like to see him own the design review process for the platform team next quarter as a stepping stone. Agree with the documentation feedback.',
   '2026-02-03 10:00:00+05:30'),
  (2, 7, 2,
   'Employee (Karthik): caught critical payment bug, expanded Cypress tests 4.5x, reduced regression from 3h to 35m, drove shift-left culture, evaluated Playwright/k6. Manager (Vikram): recommends senior QA promotion; wants more mentoring.',
   'Fully support the senior QA engineer promotion. Karthik has measurably improved release confidence and team velocity. Ask him to formalize the contract testing proposal and present it in the next engineering all-hands. Mentoring can start naturally via that initiative.',
   '2026-02-05 12:20:00+05:30');

-- ---------------------------------------------------------------------
-- Final summaries (HR - Priya, id 1)
-- ---------------------------------------------------------------------
INSERT INTO final_summaries (review_cycle_id, employee_id, hr_id, ai_summary, final_summary, submitted_at) VALUES
  (2, 5, 1,
   'Arjun: delivered high-impact notification service, fixed critical memory leak, learned K8s operators, strong mentorship and PR reviewing. Manager Anita recommends tech lead track. Delivery head Rahul endorses and suggests leading platform design reviews. Common improvement area: documentation rigor.',
   'Approved for promotion to Tech Lead track effective next cycle. Compensation revision per band L5. Development plan: (1) own platform design review process, (2) attend internal architecture guild, (3) improve documentation habits — HR to pair with technical writing buddy. Strong overall performer — high potential retention priority.',
   '2026-02-12 09:00:00+05:30'),
  (2, 7, 1,
   'Karthik: caught critical pre-prod bug, massively improved test automation (3h→35m regression), drove shift-left practices, evaluated new tools. Manager Vikram recommends Senior QA Engineer promotion. Delivery head Rahul concurs and wants contract testing proposal formalized. Growth area: active mentoring.',
   'Approved for promotion to Senior QA Engineer effective next cycle. Compensation revision per QA senior band. Development plan: (1) present contract testing proposal at engineering all-hands, (2) formally mentor 1 junior QA, (3) take QA lead certification (company-sponsored). Exemplary performance — recognition award recommended.',
   '2026-02-14 16:45:00+05:30');

-- ---------------------------------------------------------------------
-- Sanity check
-- ---------------------------------------------------------------------
-- SELECT 'categories' tbl, COUNT(*) FROM employee_categories
-- UNION ALL SELECT 'employees', COUNT(*) FROM employees
-- UNION ALL SELECT 'questions', COUNT(*) FROM questionnaires
-- UNION ALL SELECT 'cycles', COUNT(*) FROM review_cycles
-- UNION ALL SELECT 'responses', COUNT(*) FROM employee_responses
-- UNION ALL SELECT 'mgr_feedback', COUNT(*) FROM manager_feedback
-- UNION ALL SELECT 'dh_reviews', COUNT(*) FROM delivery_head_reviews
-- UNION ALL SELECT 'final_summaries', COUNT(*) FROM final_summaries;
