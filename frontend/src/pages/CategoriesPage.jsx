import { useEffect, useState } from 'react';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, Stack, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api/client';

export default function CategoriesPage() {
  const [rows, setRows]       = useState([]);
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null); // null = create; row = edit
  const [form, setForm]       = useState({ name: '', description: '' });
  const [error, setError]     = useState('');

  const load = async () => {
    try { setRows(await api.listCategories()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true); };
  const openEdit   = (row) => { setEditing(row); setForm({ name: row.name, description: row.description || '' }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) await api.updateCategory(editing.id, form);
      else         await api.createCategory(form);
      setOpen(false); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    try { await api.deleteCategory(row.id); load(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Employee Categories</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Category
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.description}</TableCell>
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
        <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name" fullWidth required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Description" fullWidth multiline rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
