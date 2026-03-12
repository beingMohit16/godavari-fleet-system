import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('gf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const login = (d) => api.post('/auth/login', d);
export const register = (d) => api.post('/auth/register', d);
export const getMe = () => api.get('/auth/me');

export const getVehicles = () => api.get('/vehicles');
export const createVehicle = (d) => api.post('/vehicles', d);
export const updateVehicle = (id, d) => api.put(`/vehicles/${id}`, d);
export const getVehicleLocations = () => api.get('/vehicles/locations');
export const updateGPS = (id, lat, lng) => api.post(`/vehicles/${id}/gps`, { lat, lng });

export const getTrips = () => api.get('/trips');
export const getTrip = (id) => api.get(`/trips/${id}`);
export const createTrip = (d) => api.post('/trips', d);
export const assignTrip = (id, d) => api.put(`/trips/${id}/assign`, d);
export const updateTripStatus = (id, status) => api.put(`/trips/${id}/status`, { status });
export const postDriverUpdate = (tripId, data, photo) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
  if (photo) fd.append('photo', photo);
  return api.post(`/trips/${tripId}/updates`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getExpenses = () => api.get('/expenses');
export const createExpense = (data, receipt) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
  if (receipt) fd.append('receipt', receipt);
  return api.post('/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const approveExpense = (id, status) => api.put(`/expenses/${id}/approve`, { status });

export const uploadDocument = (tripId, docType, file) => {
  const fd = new FormData();
  fd.append('trip_id', tripId); fd.append('doc_type', docType); fd.append('file', file);
  return api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getInvoices = () => api.get('/invoices');
export const createInvoice = (d) => api.post('/invoices', d);
export const updateInvoiceStatus = (id, status) => api.put(`/invoices/${id}/status`, { status });

export const getUsers = () => api.get('/users');
export const getDrivers = () => api.get('/users/drivers');
export const getDashboard = () => api.get('/dashboard');
export const getAnalytics = (period = 'monthly') => api.get(`/analytics?period=${period}`);

// ── Download helpers (use axios for auth token) ────────────────────────────
function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export const downloadExpenseReport = async (params = {}) => {
  const q = new URLSearchParams(params).toString();
  const res = await api.get(`/reports/expenses${q ? '?' + q : ''}`, { responseType: 'blob' });
  triggerDownload(res.data, 'expense-report.xlsx');
};

export const downloadTripReport = async () => {
  const res = await api.get('/reports/trips', { responseType: 'blob' });
  triggerDownload(res.data, 'trip-report.xlsx');
};

export const downloadAnalyticsReport = async () => {
  const res = await api.get('/reports/analytics', { responseType: 'blob' });
  triggerDownload(res.data, 'analytics-report.xlsx');
};

export const downloadTripDocuments = async (tripId) => {
  const res = await api.get(`/trips/${tripId}/documents/download`, { responseType: 'blob' });
  triggerDownload(res.data, `trip-${tripId.slice(0,8)}-docs.zip`);
};

export const downloadDocument = async (docId, filename) => {
  const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
  triggerDownload(res.data, filename || 'document');
};

export const viewInvoicePDF = (id) => {
  // Open invoice in new tab - needs token in URL since it's a new window
  const token = localStorage.getItem('gf_token');
  return `/api/reports/invoice/${id}?token=${token}`;
};

export default api;
