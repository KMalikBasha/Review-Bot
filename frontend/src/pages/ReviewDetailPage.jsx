import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Paper, Stack, Alert, Button, Chip, Divider, Box,
  Table, TableBody, TableRow, TableCell,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api } from '../api/client';

function Section({ title, subtitle, status, children }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Chip
          size="small"
          label={status === 'submitted' ? 'Submitted' : 'Pending'}
          color={status === 'submitted' ? 'success' : 'default'}
          variant={status === 'submitted' ? 'filled' : 'outlined'}
        />
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}

function FieldBlock({ label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ReviewDetailPage() {
  const { cycleId, employeeId } = useParams();
  const navigate = useNavigate();
  const [data, setData]   = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setData(await api.getEmployeeReview(cycleId, employeeId)); }
      catch (e) { setError(e.response?.data?.error || e.message); }
    })();
  }, [cycleId, employeeId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>Loading…</Typography>;

  const { employee, cycle, responses, managerFeedback, deliveryHeadReview, finalSummary } = data;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/reviews')}>
          Back to Reviews
        </Button>
      </Stack>

      {/* Employee + cycle header */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>{employee.name}</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {employee.email} · {employee.category_name}
        </Typography>
        <Table size="small" sx={{ mt: 2 }}>
          <TableBody>
            <TableRow><TableCell sx={{ border: 0, pl: 0, width: 180 }}>Cycle</TableCell><TableCell sx={{ border: 0 }}>{cycle.name}</TableCell></TableRow>
            <TableRow><TableCell sx={{ border: 0, pl: 0 }}>Manager</TableCell><TableCell sx={{ border: 0 }}>{employee.manager_name || '—'}</TableCell></TableRow>
            <TableRow><TableCell sx={{ border: 0, pl: 0 }}>Delivery Head</TableCell><TableCell sx={{ border: 0 }}>{employee.delivery_head_name || '—'}</TableCell></TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Employee responses */}
      <Section
        title="Employee Responses"
        subtitle={responses[0]?.submitted_at ? `Submitted ${new Date(responses[0].submitted_at).toLocaleString()}` : null}
        status={responses.length > 0 ? 'submitted' : 'pending'}
      >
        {responses.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No responses yet.</Typography>
        ) : (
          responses.map((r) => (
            <Box key={r.question_order} sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                Q{r.question_order}. {r.question_text}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, pl: 2, borderLeft: '3px solid', borderColor: 'primary.main', whiteSpace: 'pre-wrap' }}>
                {r.response_text}
              </Typography>
            </Box>
          ))
        )}
      </Section>

      {/* Manager feedback */}
      <Section
        title="Manager Feedback"
        subtitle={managerFeedback ? `${managerFeedback.manager_name} · ${new Date(managerFeedback.submitted_at).toLocaleString()}` : 'Awaiting manager'}
        status={managerFeedback ? 'submitted' : 'pending'}
      >
        {managerFeedback ? (
          <>
            <FieldBlock label="AI Summary" value={managerFeedback.ai_summary} />
            <FieldBlock label="Manager's Feedback" value={managerFeedback.feedback_text} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">Not submitted yet.</Typography>
        )}
      </Section>

      {/* Delivery head review */}
      <Section
        title="Delivery Head Review"
        subtitle={deliveryHeadReview ? `${deliveryHeadReview.delivery_head_name} · ${new Date(deliveryHeadReview.submitted_at).toLocaleString()}` : 'Awaiting delivery head'}
        status={deliveryHeadReview ? 'submitted' : 'pending'}
      >
        {deliveryHeadReview ? (
          <>
            <FieldBlock label="AI Summary" value={deliveryHeadReview.ai_summary} />
            <FieldBlock label="Delivery Head's Review" value={deliveryHeadReview.review_text} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">Not submitted yet.</Typography>
        )}
      </Section>

      {/* HR final summary */}
      <Section
        title="HR Final Summary"
        subtitle={finalSummary ? `${finalSummary.hr_name} · ${new Date(finalSummary.submitted_at).toLocaleString()}` : 'Awaiting HR'}
        status={finalSummary ? 'submitted' : 'pending'}
      >
        {finalSummary ? (
          <>
            <FieldBlock label="AI Summary" value={finalSummary.ai_summary} />
            <FieldBlock label="Final Summary" value={finalSummary.final_summary} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">Not submitted yet.</Typography>
        )}
      </Section>
    </Stack>
  );
}