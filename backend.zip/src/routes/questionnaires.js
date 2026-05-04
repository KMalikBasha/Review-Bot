const router = require('express').Router();
const db = require('../db');

// GET /api/questionnaires?category_id=1
router.get('/', async (req, res, next) => {
  try {
    const { category_id } = req.query;
    const sql = category_id
      ? `SELECT * FROM questionnaires WHERE category_id = $1 ORDER BY question_order`
      : `SELECT * FROM questionnaires ORDER BY category_id, question_order`;
    const { rows } = await db.query(sql, category_id ? [category_id] : []);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/questionnaires  { category_id, question_order, question_text }
router.post('/', async (req, res, next) => {
  try {
    const { category_id, question_order, question_text } = req.body;
    if (!category_id || !question_order || !question_text) {
      return res.status(400).json({ error: 'category_id, question_order, question_text required' });
    }
    const { rows } = await db.query(
      `INSERT INTO questionnaires (category_id, question_order, question_text)
       VALUES ($1, $2, $3) RETURNING *`,
      [category_id, question_order, question_text]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/questionnaires/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { question_order, question_text, is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE questionnaires
       SET question_order = COALESCE($1, question_order),
           question_text  = COALESCE($2, question_text),
           is_active      = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [question_order, question_text, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/questionnaires/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM questionnaires WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
