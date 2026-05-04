const router = require('express').Router();
const db = require('../db');

// GET /api/employees?role=employee&category_id=1
router.get('/', async (req, res, next) => {
  try {
    const { role, category_id } = req.query;
    const filters = [];
    const params  = [];
    if (role)        { params.push(role);        filters.push(`e.role = $${params.length}`); }
    if (category_id) { params.push(category_id); filters.push(`e.category_id = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT e.id, e.name, e.email, e.teams_user_id, e.role, e.is_active,
              c.name AS category_name,
              m.name AS manager_name,
              d.name AS delivery_head_name
       FROM employees e
       LEFT JOIN employee_categories c ON c.id = e.category_id
       LEFT JOIN employees m           ON m.id = e.manager_id
       LEFT JOIN employees d           ON d.id = e.delivery_head_id
       ${where}
       ORDER BY e.id`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/employees/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM employees WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/employees
router.post('/', async (req, res, next) => {
  try {
    const {
      name, email, teams_user_id,
      category_id, role, manager_id, delivery_head_id,
    } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'name, email, role required' });
    }
    const { rows } = await db.query(
      `INSERT INTO employees
         (name, email, teams_user_id, category_id, role, manager_id, delivery_head_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, email, teams_user_id, category_id, role, manager_id, delivery_head_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
