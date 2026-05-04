const router = require('express').Router();
const db = require('../db');

// GET /api/categories
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, description, created_at FROM employee_categories ORDER BY id'
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/categories  { name, description }
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      `INSERT INTO employee_categories (name, description)
       VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const { rows } = await db.query(
      `UPDATE employee_categories
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *`,
      [name, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM employee_categories WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
