const router = require('express').Router();
const db = require('../db');

// GET /api/checkins/cycle/:cycleId
// List all check-in periods for a cycle, with per-period completion stats
router.get('/cycle/:cycleId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         cp.*,
         COUNT(DISTINCT cr.employee_id)                    AS responded_employees,
         (SELECT COUNT(*) FROM employees
           WHERE role = 'employee' AND is_active = TRUE)   AS total_employees
       FROM checkin_periods cp
       LEFT JOIN checkin_responses cr ON cr.checkin_period_id = cp.id
       WHERE cp.review_cycle_id = $1
       GROUP BY cp.id
       ORDER BY cp.period_number`,
      [req.params.cycleId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/checkins/period/:periodId
// Get a single period with per-employee completion status
router.get('/period/:periodId', async (req, res, next) => {
  try {
    const { rows: period } = await db.query(
      `SELECT cp.*, rc.name AS cycle_name, rc.checkin_type
       FROM checkin_periods cp
       JOIN review_cycles rc ON rc.id = cp.review_cycle_id
       WHERE cp.id = $1`,
      [req.params.periodId]
    );
    if (!period.length) return res.status(404).json({ error: 'Not found' });

    // Employee completion for this period
    const { rows: empRows } = await db.query(
      `WITH answered AS (
         SELECT employee_id, COUNT(*) AS answered
         FROM checkin_responses
         WHERE checkin_period_id = $1
         GROUP BY employee_id
       ),
       total_q AS (
         SELECT e.id AS employee_id, COUNT(q.id) AS total
         FROM employees e
         LEFT JOIN questionnaires q ON q.category_id = e.category_id AND q.is_active = TRUE
         WHERE e.role = 'employee' AND e.is_active = TRUE
         GROUP BY e.id
       )
       SELECT
         e.id, e.name, e.email,
         COALESCE(a.answered, 0)                           AS answered,
         COALESCE(tq.total, 0)                             AS total_questions,
         CASE WHEN COALESCE(a.answered,0) >= COALESCE(tq.total,0)
                   AND COALESCE(tq.total,0) > 0
              THEN 'submitted' ELSE 'pending' END           AS status
       FROM employees e
       LEFT JOIN answered  a  ON a.employee_id  = e.id
       LEFT JOIN total_q   tq ON tq.employee_id = e.id
       WHERE e.role = 'employee' AND e.is_active = TRUE
       ORDER BY e.name`,
      [req.params.periodId]
    );

    res.json({ period: period[0], employees: empRows });
  } catch (e) { next(e); }
});

// GET /api/checkins/period/:periodId/employee/:employeeId
// Get all check-in responses for one employee in one period
router.get('/period/:periodId/employee/:employeeId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         cr.id, cr.response_text, cr.submitted_at,
         q.id AS question_id, q.question_text, q.question_order
       FROM checkin_responses cr
       JOIN questionnaires q ON q.id = cr.question_id
       WHERE cr.checkin_period_id = $1 AND cr.employee_id = $2
       ORDER BY q.question_order`,
      [req.params.periodId, req.params.employeeId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
