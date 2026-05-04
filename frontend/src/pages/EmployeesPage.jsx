import { useEffect, useState } from 'react';
import {
  Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, Stack, Alert, MenuItem, Select, InputLabel, FormControl, Chip,
} from '@mui/material';
import { api } from '../api/client';

const roleColor = {
  employee:      'default',
  manager:       'primary',
  delivery_head: 'secondary',
  hr:            'success',
};

export default function EmployeesPage() {
  const [rows, setRows]         = useState([]);
  const [filterRole, setFilterRole] = useState('');
  const [error, setError]       = useState('');

  const load = async () => {
    try { setRows(await api.listEmployees(filterRole ? { role: filterRole } : {})); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, [filterRole]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Employees</Typography>

      <FormControl sx={{ maxWidth: 220 }} size="small">
        <InputLabel>Filter by role</InputLabel>
        <Select
          label="Filter by role"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="employee">Employee</MenuItem>
          <MenuItem value="manager">Manager</MenuItem>
          <MenuItem value="delivery_head">Delivery Head</MenuItem>
          <MenuItem value="hr">HR</MenuItem>
        </Select>
      </FormControl>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Delivery Head</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.category_name || '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.role} color={roleColor[r.role]} />
                </TableCell>
                <TableCell>{r.manager_name || '—'}</TableCell>
                <TableCell>{r.delivery_head_name || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
