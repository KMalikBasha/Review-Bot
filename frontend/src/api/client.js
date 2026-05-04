import axios from 'axios';

// '/api' is proxied to http://localhost:4000 via vite.config.js
const client = axios.create({ baseURL: '/api' });

export const api = {
  // Categories
  listCategories:   ()               => client.get('/categories').then(r => r.data),
  createCategory:   (payload)        => client.post('/categories', payload).then(r => r.data),
  updateCategory:   (id, payload)    => client.put(`/categories/${id}`, payload).then(r => r.data),
  deleteCategory:   (id)             => client.delete(`/categories/${id}`),

  // Questionnaires
  listQuestions:    (categoryId)     => client.get('/questionnaires', { params: { category_id: categoryId } }).then(r => r.data),
  createQuestion:   (payload)        => client.post('/questionnaires', payload).then(r => r.data),
  updateQuestion:   (id, payload)    => client.put(`/questionnaires/${id}`, payload).then(r => r.data),
  deleteQuestion:   (id)             => client.delete(`/questionnaires/${id}`),

  // Employees
  listEmployees:    (params = {})    => client.get('/employees', { params }).then(r => r.data),
  createEmployee:   (payload)        => client.post('/employees', payload).then(r => r.data),

  // Cycles
  listCycles:       ()               => client.get('/cycles').then(r => r.data),
  createCycle:      (payload)        => client.post('/cycles', payload).then(r => r.data),
  updateCycle:      (id, payload)    => client.put(`/cycles/${id}`, payload).then(r => r.data),

  // Reviews
  listReviewsByCycle:  (cycleId)                => client.get(`/reviews/cycle/${cycleId}`).then(r => r.data),
  getEmployeeReview:   (cycleId, employeeId)    => client.get(`/reviews/cycle/${cycleId}/employee/${employeeId}`).then(r => r.data),

  // Check-in periods
  listCheckinPeriods:       (cycleId)           => client.get(`/checkins/cycle/${cycleId}`).then(r => r.data),
  getCheckinPeriod:         (periodId)          => client.get(`/checkins/period/${periodId}`).then(r => r.data),
  getCheckinPeriodEmployee: (periodId, empId)   => client.get(`/checkins/period/${periodId}/employee/${empId}`).then(r => r.data),

  // Quarterly reviews
  listQuarterlyReviews: (cycleId)               => client.get(`/quarterly/cycle/${cycleId}`).then(r => r.data),
  getQuarterlyReview:   (id)                    => client.get(`/quarterly/${id}`).then(r => r.data),
  updateQuarterlyReview:(id, payload)           => client.put(`/quarterly/${id}`, payload).then(r => r.data),

  // Cycle assignments
  listAssignments:  (cycleId)              => client.get(`/assignments/cycle/${cycleId}`).then(r => r.data),
  createAssignment: (payload)              => client.post('/assignments', payload).then(r => r.data),
  deleteAssignment: (id)                   => client.delete(`/assignments/${id}`).then(r => r.data),
};
