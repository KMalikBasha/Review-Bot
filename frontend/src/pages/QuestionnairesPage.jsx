import { useEffect, useState } from 'react';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, Stack, Alert, MenuItem, Select, InputLabel, FormControl,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api/client';

export default function QuestionnairesPage() {
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat]   = useState('');
  const [rows, setRows]             = useState([]);
  const [open, setOpen]             = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState({ category_id: '', question_order: 1, question_text: '' });
  const [error, setError]           = useState('');

  const loadCategories = async () => {
    try { setCategories(await api.listCategories()); }
    catch (e) { setError(e.message); }
  };

  const loadQuestions = async () => {
    try { setRows(await api.listQuestions(filterCat || undefined)); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadQuestions(); }, [filterCat]);

  const openCreate = () => {
    setEditing(null);
    setForm({ category_id: filterCat || '', question_order: rows.length + 1, question_text: '' });
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ category_id: row.category_id, question_order: row.question_order, question_text: row.question_text });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await api.updateQuestion(editing.id, form);
      else         await api.createQuestion(form);
      setOpen(false); loadQuestions();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const remove = async (row) => {
    if (!confirm('Delete this question?')) return;
    try { await api.deleteQuestion(row.id); loadQuestions(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Questionnaires</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Question
        </Button>
      </Stack>

      <FormControl sx={{ maxWidth: 260 }} size="small">
        <InputLabel>Filter by category</InputLabel>
        <Select
          label="Filter by category"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Question</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{categoryName(r.category_id)}</TableCell>
                <TableCell>{r.question_order}</TableCell>
                <TableCell>{r.question_text}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => openEdit(r)}><EditIcon /></IconButton>
                  <IconButton onClick={() => remove(r)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Question' : 'New Question'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Order" type="number" fullWidth required
              value={form.question_order}
              onChange={(e) => setForm({ ...form, question_order: Number(e.target.value) })}
            />
            <TextField
              label="Question Text" fullWidth required multiline rows={3}
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
