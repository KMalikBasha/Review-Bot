const router = require('express').Router();
const db = require('../db');

/**
 * GET /api/reviews/cycle/:cycleId
 * Returns list of employees in the cycle with completion status
 * at each stage (employee response / manager feedback / DH review / HR final).
 */
router.get('/cycle/:cycleId', async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    const { rows } = await db.query(
      `
      WITH cycle AS (
        SELECT id FROM review_cycles WHERE id = $1
      ),
      emp_resp AS (
        SELECT employee_id, COUNT(*) AS answered
        FROM employee_responses
        WHERE review_cycle_id = $1
        GROUP BY employee_id
      ),
      total_q AS (
        SELECT e.id AS employee_id, COUNT(q.id) AS total
        FROM employees e
        LEFT JOIN questionnaires q
          ON q.category_id = e.category_id AND q.is_active = TRUE
        WHERE e.role = 'employee'
        GROUP BY e.id
      )
      SELECT
        e.id, e.name, e.email,
        c.name AS category_name,
        m.name AS manager_name,
        d.name AS delivery_head_name,
        COALESCE(er.answered, 0)  AS answered_count,
        COALESCE(tq.total, 0)     AS total_questions,
        CASE WHEN er.answered IS NOT NULL AND er.answered >= tq.total AND tq.total > 0
             THEN 'submitted' ELSE 'pending' END AS employee_status,
        CASE WHEN mf.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS manager_status,
        CASE WHEN dh.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS delivery_head_status,
        CASE WHEN fs.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS hr_status
      FROM employees e
      LEFT JOIN employee_categories c    ON c.id = e.category_id
      LEFT JOIN employees m              ON m.id = e.manager_id
      LEFT JOIN employees d              ON d.id = e.delivery_head_id
      LEFT JOIN emp_resp er              ON er.employee_id = e.id
      LEFT JOIN total_q  tq              ON tq.employee_id = e.id
      LEFT JOIN manager_feedback      mf ON mf.employee_id = e.id AND mf.review_cycle_id = $1
      LEFT JOIN delivery_head_reviews dh ON dh.employee_id = e.id AND dh.review_cycle_id = $1
      LEFT JOIN final_summaries       fs ON fs.employee_id = e.id AND fs.review_cycle_id = $1
      WHERE e.role = 'employee' AND e.is_active = TRUE
      ORDER BY e.id
      `,
      [cycleId]
    );

    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * GET /api/reviews/cycle/:cycleId/employee/:employeeId
 * Returns all stakeholder data for one employee in a cycle:
 *   - employee answers (question + response)
 *   - manager feedback (ai summary + feedback)
 *   - delivery head review
 *   - HR final summary
 */
router.get('/cycle/:cycleId/employee/:employeeId', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;

    const [employee, cycle, responses, managerFb, dhReview, finalSummary] = await Promise.all([
      db.query(
        `SELECT e.id, e.name, e.email, c.name AS category_name,
                m.name AS manager_name, d.name AS delivery_head_name
         FROM employees e
         LEFT JOIN employee_categories c ON c.id = e.category_id
         LEFT JOIN employees m           ON m.id = e.manager_id
         LEFT JOIN employees d           ON d.id = e.delivery_head_id
         WHERE e.id = $1`,
        [employeeId]
      ),
      db.query(`SELECT * FROM review_cycles WHERE id = $1`, [cycleId]),
      db.query(
        `SELECT q.question_order, q.question_text, r.response_text, r.submitted_at
         FROM employee_responses r
         JOIN questionnaires q ON q.id = r.questionnaire_id
         WHERE r.review_cycle_id = $1 AND r.employee_id = $2
         ORDER BY q.question_order`,
        [cycleId, employeeId]
      ),
      db.query(
        `SELECT mf.*, e.name AS manager_name
         FROM manager_feedback mf
         LEFT JOIN employees e ON e.id = mf.manager_id
         WHERE mf.review_cycle_id = $1 AND mf.employee_id = $2`,
        [cycleId, employeeId]
      ),
      db.query(
        `SELECT dh.*, e.name AS delivery_head_name
         FROM delivery_head_reviews dh
         LEFT JOIN employees e ON e.id = dh.delivery_head_id
         WHERE dh.review_cycle_id = $1 AND dh.employee_id = $2`,
        [cycleId, employeeId]
      ),
      db.query(
        `SELECT fs.*, e.name AS hr_name
         FROM final_summaries fs
         LEFT JOIN employees e ON e.id = fs.hr_id
         WHERE fs.review_cycle_id = $1 AND fs.employee_id = $2`,
        [cycleId, employeeId]
      ),
    ]);

    if (!employee.rows.length) return res.status(404).json({ error: 'Employee not found' });
    if (!cycle.rows.length)    return res.status(404).json({ error: 'Cycle not found' });

    res.json({
      employee:       employee.rows[0],
      cycle:          cycle.rows[0],
      responses:      responses.rows,
      managerFeedback: managerFb.rows[0] || null,
      deliveryHeadReview: dhReview.rows[0] || null,
      finalSummary:   finalSummary.rows[0] || null,
    });
  } catch (e) { next(e); }
});

module.exports = router;