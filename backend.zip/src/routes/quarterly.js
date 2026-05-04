const router = require('express').Router();
const db = require('../db');

// GET /api/quarterly/cycle/:cycleId
// List all quarterly reviews for a cycle, one row per (employee, quarter)
router.get('/cycle/:cycleId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         qr.*,
         e.name  AS employee_name,
         e.email AS employee_email,
         m.name  AS manager_name
       FROM quarterly_reviews qr
       JOIN employees e ON e.id = qr.employee_id
       LEFT JOIN employees m ON m.id = qr.manager_id
       WHERE qr.review_cycle_id = $1
       ORDER BY qr.quarter_start, e.name`,
      [req.params.cycleId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/quarterly/:id
// Full detail for one quarterly review, including aggregated check-in responses
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: qrRows } = await db.query(
      `SELECT
         qr.*,
         e.name  AS employee_name,
         e.email AS employee_email,
         m.name  AS manager_name,
         rc.name AS cycle_name
       FROM quarterly_reviews qr
       JOIN employees e ON e.id = qr.employee_id
       LEFT JOIN employees m ON m.id = qr.manager_id
       JOIN review_cycles rc ON rc.id = qr.review_cycle_id
       WHERE qr.id = $1`,
      [req.params.id]
    );
    if (!qrRows.length) return res.status(404).json({ error: 'Not found' });
    const qr = qrRows[0];

    // All check-in responses for this employee within the quarter window
    const { rows: checkins } = await db.query(
      `SELECT
         cp.period_label, cp.period_start, cp.period_end,
         q.question_order, q.question_text,
         cr.response_text, cr.submitted_at
       FROM checkin_responses cr
       JOIN checkin_periods cp  ON cp.id  = cr.checkin_period_id
       JOIN questionnaires  q   ON q.id   = cr.question_id
       WHERE cr.employee_id       = $1
         AND cp.review_cycle_id   = $2
         AND cp.period_start     >= $3
         AND cp.period_end       <= $4
       ORDER BY cp.period_number, q.question_order`,
      [qr.employee_id, qr.review_cycle_id, qr.quarter_start, qr.quarter_end]
    );

    res.json({ quarterlyReview: qr, checkins });
  } catch (e) { next(e); }
});

// PUT /api/quarterly/:id
// Manager submits their notes and marks the review done
router.put('/:id', async (req, res, next) => {
  try {
    const { manager_notes, manager_id, status } = req.body;
    const isSubmitting = status === 'submitted';

    const { rows } = await db.query(
      `UPDATE quarterly_reviews SET
         manager_notes = COALESCE($1, manager_notes),
         manager_id    = COALESCE($2, manager_id),
         status        = COALESCE($3, status),
         submitted_at  = CASE WHEN $3 = 'submitted' THEN NOW() ELSE submitted_at END
       WHERE id = $4
       RETURNING *`,
      [manager_notes, manager_id, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
