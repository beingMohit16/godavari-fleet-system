const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const XLSX = require('xlsx');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'govfleet-secret-2024';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const DB_PATH = path.join(__dirname, '../fleet.db');
let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params = []) {
  let i = 0;
  const filled = sql.replace(/\?/g, () => {
    const val = params[i++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    return `'${String(val).replace(/'/g, "''")}'`;
  });
  const results = db.exec(filled);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, j) => { obj[col] = row[j]; });
    return obj;
  });
}

function queryRun(sql, params = []) {
  let i = 0;
  const filled = sql.replace(/\?/g, () => {
    const val = params[i++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    return `'${String(val).replace(/'/g, "''")}'`;
  });
  db.run(filled);
  saveDb();
}

function queryGet(sql, params = []) {
  return queryAll(sql, params)[0];
}

// ── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden: insufficient role' });
    next();
  };
}

// ── Helper: Generate Excel buffer from data ─────────────────────────────────
function generateExcel(data, sheetName = 'Report') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function startServer() {
  const SQL = await initSqlJs();

  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  // ── Schema ──────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL,
    company TEXT, phone TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY, registration TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, capacity REAL NOT NULL, driver_id TEXT,
    status TEXT DEFAULT 'Available', lat REAL DEFAULT 20.5937, lng REAL DEFAULT 78.9629,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY, vehicle_id TEXT, driver_id TEXT,
    customer_id TEXT, cargo_type TEXT NOT NULL,
    pickup TEXT NOT NULL, destination TEXT NOT NULL,
    distance REAL NOT NULL, status TEXT DEFAULT 'Pending',
    pickup_lat REAL, pickup_lng REAL, dest_lat REAL, dest_lng REAL,
    notes TEXT, booking_date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, trip_id TEXT NOT NULL,
    expense_type TEXT NOT NULL, amount REAL NOT NULL,
    date TEXT NOT NULL, notes TEXT, receipt_file TEXT,
    submitted_by TEXT, approved_by TEXT, status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, trip_id TEXT NOT NULL,
    doc_type TEXT NOT NULL, filename TEXT NOT NULL,
    original_name TEXT NOT NULL, uploaded_by TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, trip_id TEXT NOT NULL,
    customer_id TEXT, customer_name TEXT NOT NULL,
    freight_rate REAL NOT NULL, distance REAL NOT NULL,
    total_amount REAL NOT NULL, status TEXT DEFAULT 'Draft',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS driver_updates (
    id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, driver_id TEXT NOT NULL,
    update_type TEXT NOT NULL, message TEXT,
    lat REAL, lng REAL, photo_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  saveDb();

  // ── Seed Users & Data ────────────────────────────────────────────────────
  async function seedData() {
    const count = queryGet('SELECT COUNT(*) as cnt FROM users');
    if (count && count.cnt > 0) return;

    const hash = (p) => bcrypt.hashSync(p, 10);

    const users = [
      { id: uuidv4(), name: 'GovFleet Admin',    email: 'admin@govfleet.in',    pw: 'admin123',    role: 'company',  company: 'GovFleet Logistics' },
      { id: uuidv4(), name: 'Health Ministry',   email: 'health@gov.in',        pw: 'customer123', role: 'customer', company: 'Ministry of Health' },
      { id: uuidv4(), name: 'PWD Department',    email: 'pwd@gov.in',           pw: 'customer123', role: 'customer', company: 'Public Works Dept' },
      { id: uuidv4(), name: 'Food Corporation',  email: 'fci@gov.in',           pw: 'customer123', role: 'customer', company: 'Food Corp of India' },
      { id: uuidv4(), name: 'Ramesh Kumar',      email: 'ramesh@driver.in',     pw: 'driver123',   role: 'driver',   phone: '9876543210' },
      { id: uuidv4(), name: 'Suresh Patel',      email: 'suresh@driver.in',     pw: 'driver123',   role: 'driver',   phone: '9876543211' },
      { id: uuidv4(), name: 'Vijay Singh',       email: 'vijay@driver.in',      pw: 'driver123',   role: 'driver',   phone: '9876543212' },
      { id: uuidv4(), name: 'Arun Nair',         email: 'arun@driver.in',       pw: 'driver123',   role: 'driver',   phone: '9876543213' },
    ];
    users.forEach(u => queryRun(
      `INSERT INTO users (id,name,email,password,role,company,phone) VALUES (?,?,?,?,?,?,?)`,
      [u.id, u.name, u.email, hash(u.pw), u.role, u.company||null, u.phone||null]
    ));

    const drivers = users.filter(u => u.role === 'driver');
    const customers = users.filter(u => u.role === 'customer');

    const vehicles = [
      { id: uuidv4(), reg: 'MH-12-AB-1234', type: 'Truck',       cap: 15, lat: 19.076, lng: 72.877 },
      { id: uuidv4(), reg: 'DL-01-CD-5678', type: 'Mini Van',    cap: 5,  lat: 28.613, lng: 77.209 },
      { id: uuidv4(), reg: 'KA-05-EF-9012', type: 'Heavy Truck', cap: 25, lat: 12.971, lng: 77.594 },
      { id: uuidv4(), reg: 'TN-09-GH-3456', type: 'Pickup',      cap: 3,  lat: 13.083, lng: 80.270 },
      { id: uuidv4(), reg: 'GJ-18-IJ-7890', type: 'Truck',       cap: 12, lat: 23.022, lng: 72.571 },
      { id: uuidv4(), reg: 'RJ-14-KL-2345', type: 'Container',   cap: 30, lat: 26.912, lng: 75.787 },
    ];
    const vStatuses = ['Available','On Trip','On Trip','Available','Maintenance','On Trip'];
    vehicles.forEach((v, i) => queryRun(
      `INSERT INTO vehicles (id,registration,type,capacity,driver_id,status,lat,lng) VALUES (?,?,?,?,?,?,?,?)`,
      [v.id, v.reg, v.type, v.cap, drivers[i % drivers.length].id, vStatuses[i], v.lat, v.lng]
    ));

    const vRows = queryAll('SELECT * FROM vehicles');
    const cargoTypes = ['Medical Supplies','Food Grains','Construction Material','Electronics','Textiles'];
    const routes = [
      { from:'Mumbai',    to:'Pune',    dist:148, plat:19.076,plng:72.877,dlat:18.520,dlng:73.856 },
      { from:'Delhi',     to:'Agra',    dist:206, plat:28.613,plng:77.209,dlat:27.176,dlng:78.008 },
      { from:'Bangalore', to:'Chennai', dist:346, plat:12.971,plng:77.594,dlat:13.083,dlng:80.270 },
      { from:'Ahmedabad', to:'Surat',   dist:265, plat:23.022,plng:72.571,dlat:21.170,dlng:72.831 },
      { from:'Jaipur',    to:'Jodhpur', dist:330, plat:26.912,plng:75.787,dlat:26.295,dlng:73.017 },
    ];
    const tripStatuses = ['Pending','Accepted','Dispatched','In Transit','Delivered','Returned'];

    // Generate varied dates for realistic analytics (last 90 days)
    const now = new Date();
    const tripIds = [];

    for (let i = 0; i < 20; i++) {
      const tid = uuidv4();
      const r = routes[i % routes.length];
      const v = vRows[i % vRows.length];
      const cust = customers[i % customers.length];
      const drv = drivers[i % drivers.length];
      // Spread trips across last 90 days
      const daysAgo = Math.floor((i / 20) * 90);
      const tripDate = new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
      queryRun(
        `INSERT INTO trips (id,vehicle_id,driver_id,customer_id,cargo_type,pickup,destination,distance,status,pickup_lat,pickup_lng,dest_lat,dest_lng,booking_date,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime(?))`,
        [tid, v.id, drv.id, cust.id, cargoTypes[i % cargoTypes.length], r.from, r.to, r.dist, tripStatuses[i % tripStatuses.length], r.plat, r.plng, r.dlat, r.dlng, tripDate, tripDate]
      );
      tripIds.push({ id: tid, distance: r.dist, driver_id: drv.id, customer_id: cust.id, date: tripDate });
    }

    const custNames = ['Health Ministry','PWD Department','Food Corporation'];
    tripIds.forEach((t, i) => {
      queryRun(`INSERT INTO expenses (id,trip_id,expense_type,amount,date,notes,submitted_by,status) VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), t.id, 'Fuel',   Math.round(800+Math.random()*1200), t.date, 'Diesel refill', t.driver_id, 'Approved']);
      queryRun(`INSERT INTO expenses (id,trip_id,expense_type,amount,date,notes,submitted_by,status) VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), t.id, 'Toll',   Math.round(150+Math.random()*350),  t.date, 'Highway toll',  t.driver_id, 'Approved']);
      if (i % 3 === 0) queryRun(`INSERT INTO expenses (id,trip_id,expense_type,amount,date,notes,submitted_by,status) VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), t.id, 'Repair', Math.round(500+Math.random()*2000), t.date, 'Tyre puncture', t.driver_id, 'Pending']);
      if (i % 2 === 0) {
        const rate = Math.round((12+Math.random()*8)*100)/100;
        queryRun(`INSERT INTO invoices (id,trip_id,customer_id,customer_name,freight_rate,distance,total_amount,status,created_at) VALUES (?,?,?,?,?,?,?,?,datetime(?))`,
          [uuidv4(), t.id, t.customer_id, custNames[i % custNames.length], rate, t.distance, Math.round(rate*t.distance), 'Sent', t.date]);
      }
    });

    saveDb();
    console.log('✅ Sample data seeded');
    console.log('👤 Demo accounts:');
    console.log('   Company : admin@govfleet.in   / admin123');
    console.log('   Customer: health@gov.in        / customer123');
    console.log('   Driver  : ramesh@driver.in     / driver123');
  }

  await seedData();

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = queryGet('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company, phone: user.phone } });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role, company, phone } = req.body;
    if (!['customer','driver'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (queryGet('SELECT id FROM users WHERE email=?', [email])) return res.status(400).json({ error: 'Email already registered' });
    const id = uuidv4();
    queryRun(`INSERT INTO users (id,name,email,password,role,company,phone) VALUES (?,?,?,?,?,?,?)`,
      [id, name, email, bcrypt.hashSync(password, 10), role, company||null, phone||null]);
    const token = jwt.sign({ id, role, name, email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id, name, email, role, company, phone } });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = queryGet('SELECT id,name,email,role,company,phone,created_at FROM users WHERE id=?', [req.user.id]);
    res.json(user);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VEHICLE ROUTES (company only for write)
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/vehicles', authMiddleware, (req, res) => {
    const vehicles = queryAll(`
      SELECT v.*, u.name as driver_name, u.email as driver_email, u.phone as driver_phone
      FROM vehicles v LEFT JOIN users u ON v.driver_id = u.id
      ORDER BY v.created_at DESC`);
    res.json(vehicles);
  });

  app.post('/api/vehicles', authMiddleware, requireRole('company'), (req, res) => {
    const { registration, type, capacity, driver_id, status } = req.body;
    const id = uuidv4();
    queryRun(`INSERT INTO vehicles (id,registration,type,capacity,driver_id,status) VALUES (?,?,?,?,?,?)`,
      [id, registration, type, capacity, driver_id||null, status||'Available']);
    res.json({ id, registration, type, capacity, driver_id, status: status||'Available' });
  });

  app.put('/api/vehicles/:id', authMiddleware, requireRole('company'), (req, res) => {
    const { status, registration, type, capacity, driver_id } = req.body;
    queryRun(`UPDATE vehicles SET status=?,registration=?,type=?,capacity=?,driver_id=? WHERE id=?`,
      [status, registration, type, capacity, driver_id||null, req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/vehicles/locations', authMiddleware, (req, res) => {
    res.json(queryAll(`
      SELECT v.*, u.name as driver_name,
             t.destination, t.status as trip_status, t.id as trip_id,
             t.dest_lat, t.dest_lng, t.pickup_lat, t.pickup_lng
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status IN ('Dispatched','In Transit')
      ORDER BY v.created_at DESC`));
  });

  app.post('/api/vehicles/:id/gps', authMiddleware, (req, res) => {
    queryRun('UPDATE vehicles SET lat=?,lng=? WHERE id=?', [req.body.lat, req.body.lng, req.params.id]);
    res.json({ success: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TRIP ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/trips', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    let sql = `SELECT t.*, v.registration, v.type as vehicle_type,
      cu.name as customer_name, cu.company as customer_company,
      du.name as driver_name
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN users cu ON t.customer_id = cu.id
      LEFT JOIN users du ON t.driver_id = du.id`;
    let params = [];
    if (role === 'customer') { sql += ` WHERE t.customer_id=?`; params = [id]; }
    if (role === 'driver')   { sql += ` WHERE t.driver_id=?`;   params = [id]; }
    sql += ` ORDER BY t.created_at DESC`;
    res.json(queryAll(sql, params));
  });

  app.get('/api/trips/:id', authMiddleware, (req, res) => {
    const trip = queryGet(`
      SELECT t.*, v.registration, v.type as vehicle_type,
        cu.name as customer_name, cu.company as customer_company, cu.email as customer_email,
        du.name as driver_name, du.phone as driver_phone, du.email as driver_email
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN users cu ON t.customer_id = cu.id
      LEFT JOIN users du ON t.driver_id = du.id
      WHERE t.id=?`, [req.params.id]);
    if (!trip) return res.status(404).json({ error: 'Not found' });
    trip.expenses      = queryAll('SELECT e.*, u.name as submitted_by_name FROM expenses e LEFT JOIN users u ON e.submitted_by=u.id WHERE e.trip_id=? ORDER BY e.date DESC', [req.params.id]);
    trip.documents     = queryAll('SELECT d.*, u.name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by=u.id WHERE d.trip_id=? ORDER BY d.uploaded_at DESC', [req.params.id]);
    trip.invoice       = queryGet('SELECT * FROM invoices WHERE trip_id=? LIMIT 1', [req.params.id]);
    trip.driver_updates = queryAll('SELECT * FROM driver_updates WHERE trip_id=? ORDER BY created_at ASC', [req.params.id]);
    res.json(trip);
  });

  // Customer books a trip
  app.post('/api/trips', authMiddleware, requireRole('customer','company'), (req, res) => {
    const { cargo_type, pickup, destination, distance, pickup_lat, pickup_lng, dest_lat, dest_lng, notes } = req.body;
    const customer_id = req.user.role === 'customer' ? req.user.id : req.body.customer_id;
    const id = uuidv4();
    queryRun(
      `INSERT INTO trips (id,customer_id,cargo_type,pickup,destination,distance,status,pickup_lat,pickup_lng,dest_lat,dest_lng,notes) VALUES (?,?,?,?,?,?,'Pending',?,?,?,?,?)`,
      [id, customer_id, cargo_type, pickup, destination, distance, pickup_lat||null, pickup_lng||null, dest_lat||null, dest_lng||null, notes||null]
    );
    res.json({ id, customer_id, cargo_type, pickup, destination, distance, status: 'Pending' });
  });

  // Company accepts & assigns vehicle+driver
  app.put('/api/trips/:id/assign', authMiddleware, requireRole('company'), (req, res) => {
    const { vehicle_id, driver_id } = req.body;
    queryRun(`UPDATE trips SET vehicle_id=?,driver_id=?,status='Accepted',updated_at=datetime('now') WHERE id=?`,
      [vehicle_id, driver_id, req.params.id]);
    if (vehicle_id) queryRun(`UPDATE vehicles SET status='On Trip' WHERE id=?`, [vehicle_id]);
    res.json({ success: true });
  });

  // Status update (company can do all, driver can update in-journey statuses)
  app.put('/api/trips/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const { role } = req.user;
    const driverStatuses = ['Dispatched','In Transit','Delivered'];
    if (role === 'driver' && !driverStatuses.includes(status))
      return res.status(403).json({ error: 'Drivers can only update to Dispatched, In Transit or Delivered' });
    queryRun(`UPDATE trips SET status=?,updated_at=datetime('now') WHERE id=?`, [status, req.params.id]);
    if (['Returned','Delivered'].includes(status)) {
      const t = queryGet('SELECT vehicle_id FROM trips WHERE id=?', [req.params.id]);
      if (t && t.vehicle_id) queryRun(`UPDATE vehicles SET status='Available' WHERE id=?`, [t.vehicle_id]);
    }
    res.json({ success: true });
  });

  // Driver: post an update/checkpoint
  app.post('/api/trips/:id/updates', authMiddleware, requireRole('driver','company'), upload.single('photo'), (req, res) => {
    const { update_type, message, lat, lng } = req.body;
    const id = uuidv4();
    queryRun(`INSERT INTO driver_updates (id,trip_id,driver_id,update_type,message,lat,lng,photo_file) VALUES (?,?,?,?,?,?,?,?)`,
      [id, req.params.id, req.user.id, update_type, message||null, lat||null, lng||null, req.file ? req.file.filename : null]);
    res.json({ id, update_type, message, lat, lng });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // EXPENSE ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/expenses', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    let sql = `SELECT e.*, t.pickup, t.destination, u.name as submitted_by_name FROM expenses e LEFT JOIN trips t ON e.trip_id=t.id LEFT JOIN users u ON e.submitted_by=u.id`;
    let params = [];
    if (role === 'driver') { sql += ` WHERE e.submitted_by=?`; params = [id]; }
    if (role === 'customer') { sql += ` WHERE t.customer_id=?`; params = [id]; }
    sql += ` ORDER BY e.created_at DESC`;
    res.json(queryAll(sql, params));
  });

  app.post('/api/expenses', authMiddleware, requireRole('driver','company'), upload.single('receipt'), (req, res) => {
    const { trip_id, expense_type, amount, date, notes } = req.body;
    const id = uuidv4();
    const status = req.user.role === 'company' ? 'Approved' : 'Pending';
    queryRun(`INSERT INTO expenses (id,trip_id,expense_type,amount,date,notes,receipt_file,submitted_by,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, trip_id, expense_type, amount, date, notes||null, req.file ? req.file.filename : null, req.user.id, status]);
    res.json({ id, trip_id, expense_type, amount, date, notes, status });
  });

  app.put('/api/expenses/:id/approve', authMiddleware, requireRole('company'), (req, res) => {
    queryRun(`UPDATE expenses SET status=?,approved_by=? WHERE id=?`,
      [req.body.status, req.user.id, req.params.id]);
    res.json({ success: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENT ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  app.post('/api/documents', authMiddleware, upload.single('file'), (req, res) => {
    const { trip_id, doc_type } = req.body;
    const id = uuidv4();
    queryRun(`INSERT INTO documents (id,trip_id,doc_type,filename,original_name,uploaded_by) VALUES (?,?,?,?,?,?)`,
      [id, trip_id, doc_type, req.file.filename, req.file.originalname, req.user.id]);
    res.json({ id, trip_id, doc_type, filename: req.file.filename, original_name: req.file.originalname });
  });

  app.get('/api/documents/:id/download', authMiddleware, (req, res) => {
    const doc = queryGet('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOADS_DIR, doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });
    res.download(filePath, doc.original_name);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INVOICE ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/invoices', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    let sql = `SELECT i.*, t.pickup, t.destination, t.cargo_type FROM invoices i LEFT JOIN trips t ON i.trip_id=t.id`;
    let params = [];
    if (role === 'customer') { sql += ` WHERE i.customer_id=?`; params = [id]; }
    sql += ` ORDER BY i.created_at DESC`;
    res.json(queryAll(sql, params));
  });

  app.post('/api/invoices', authMiddleware, requireRole('company'), (req, res) => {
    const { trip_id, customer_name, freight_rate, distance, customer_id } = req.body;
    const total_amount = Math.round(freight_rate * distance * 100) / 100;
    const id = uuidv4();
    queryRun(`INSERT INTO invoices (id,trip_id,customer_id,customer_name,freight_rate,distance,total_amount,status) VALUES (?,?,?,?,?,?,?,'Draft')`,
      [id, trip_id, customer_id||null, customer_name, freight_rate, distance, total_amount]);
    res.json({ id, trip_id, customer_name, freight_rate, distance, total_amount, status: 'Draft' });
  });

  app.put('/api/invoices/:id/status', authMiddleware, requireRole('company'), (req, res) => {
    queryRun(`UPDATE invoices SET status=? WHERE id=?`, [req.body.status, req.params.id]);
    res.json({ success: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // USERS (company admin)
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/users', authMiddleware, requireRole('company'), (req, res) => {
    res.json(queryAll(`SELECT id,name,email,role,company,phone,created_at FROM users ORDER BY role,name`));
  });

  app.get('/api/users/drivers', authMiddleware, (req, res) => {
    res.json(queryAll(`SELECT id,name,email,phone FROM users WHERE role='driver' ORDER BY name`));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/dashboard', authMiddleware, (req, res) => {
    const { role, id } = req.user;

    if (role === 'customer') {
      const myTrips    = queryAll(`SELECT t.*, v.registration, du.name as driver_name FROM trips t LEFT JOIN vehicles v ON t.vehicle_id=v.id LEFT JOIN users du ON t.driver_id=du.id WHERE t.customer_id=? ORDER BY t.created_at DESC`, [id]);
      const myInvoices = queryAll('SELECT i.*, t.pickup, t.destination, t.cargo_type FROM invoices i LEFT JOIN trips t ON i.trip_id=t.id WHERE i.customer_id=? ORDER BY i.created_at DESC', [id]);
      const myExpenses = queryAll('SELECT e.* FROM expenses e JOIN trips t ON e.trip_id=t.id WHERE t.customer_id=? AND e.status=?', [id, 'Approved']);
      const pending    = myTrips.filter(t => t.status === 'Pending').length;
      const active     = myTrips.filter(t => ['Accepted','Dispatched','In Transit'].includes(t.status)).length;
      const delivered  = myTrips.filter(t => ['Delivered','Returned'].includes(t.status)).length;
      const totalExpenses = myExpenses.reduce((s,e) => s + e.amount, 0);
      const totalInvoiced = myInvoices.reduce((s,i) => s + i.total_amount, 0);

      // Trip stats by cargo type
      const cargoStats = {};
      myTrips.forEach(t => { cargoStats[t.cargo_type] = (cargoStats[t.cargo_type]||0) + 1; });

      // Monthly trend (last 6 months)
      const monthlyData = {};
      myTrips.forEach(t => {
        const m = (t.booking_date || t.created_at || '').slice(0, 7);
        if (!monthlyData[m]) monthlyData[m] = { month: m, trips: 0, invoiced: 0 };
        monthlyData[m].trips++;
      });
      myInvoices.forEach(inv => {
        const m = (inv.created_at || '').slice(0, 7);
        if (monthlyData[m]) monthlyData[m].invoiced += inv.total_amount;
      });

      // Route breakdown
      const routeStats = {};
      myTrips.forEach(t => {
        const route = `${t.pickup} → ${t.destination}`;
        if (!routeStats[route]) routeStats[route] = { route, trips: 0, distance: 0 };
        routeStats[route].trips++;
        routeStats[route].distance += t.distance;
      });

      return res.json({
        role, totalTrips: myTrips.length, pending, active, delivered,
        totalInvoiced, totalExpenses,
        avgTripDistance: myTrips.length ? Math.round(myTrips.reduce((s,t)=>s+t.distance,0)/myTrips.length) : 0,
        cargoStats: Object.entries(cargoStats).map(([cargo_type, count]) => ({ cargo_type, count })),
        monthlyData: Object.values(monthlyData).sort((a,b) => a.month.localeCompare(b.month)),
        routeStats: Object.values(routeStats).sort((a,b) => b.trips - a.trips),
        recentTrips: myTrips.slice(0, 10),
        invoices: myInvoices,
        expenses: myExpenses
      });
    }

    if (role === 'driver') {
      const myTrips = queryAll(`SELECT t.*, v.registration, cu.name as customer_name FROM trips t LEFT JOIN vehicles v ON t.vehicle_id=v.id LEFT JOIN users cu ON t.customer_id=cu.id WHERE t.driver_id=? ORDER BY t.created_at DESC`, [id]);
      const myExpenses = queryAll('SELECT * FROM expenses WHERE submitted_by=?', [id]);
      const active = myTrips.find(t => ['Dispatched','In Transit'].includes(t.status));
      const approvedExp = myExpenses.filter(e => e.status === 'Approved');
      const pendingExp = myExpenses.filter(e => e.status === 'Pending');
      const rejectedExp = myExpenses.filter(e => e.status === 'Rejected');

      // Expense breakdown by type
      const expByType = {};
      myExpenses.forEach(e => { expByType[e.expense_type] = (expByType[e.expense_type]||0) + e.amount; });

      // Monthly expenses
      const monthlyExp = {};
      myExpenses.forEach(e => {
        const m = (e.date || '').slice(0, 7);
        if (!monthlyExp[m]) monthlyExp[m] = { month: m, amount: 0, count: 0 };
        monthlyExp[m].amount += e.amount;
        monthlyExp[m].count++;
      });

      // Trip stats
      const completedTrips = myTrips.filter(t => ['Delivered','Returned'].includes(t.status)).length;
      const totalDistance = myTrips.reduce((s,t) => s + t.distance, 0);

      // Route frequency
      const routeFreq = {};
      myTrips.forEach(t => {
        const route = `${t.pickup} → ${t.destination}`;
        routeFreq[route] = (routeFreq[route]||0) + 1;
      });

      return res.json({
        role, totalTrips: myTrips.length, activeTrip: active || null,
        completedTrips, totalDistance,
        pendingExpenses: pendingExp.length,
        approvedExpenses: approvedExp.reduce((s,e) => s + e.amount, 0),
        rejectedExpenses: rejectedExp.reduce((s,e) => s + e.amount, 0),
        totalExpensesClaimed: myExpenses.reduce((s,e) => s + e.amount, 0),
        expenseByType: Object.entries(expByType).map(([expense_type, total]) => ({ expense_type, total })),
        monthlyExpenses: Object.values(monthlyExp).sort((a,b) => a.month.localeCompare(b.month)),
        routeFrequency: Object.entries(routeFreq).map(([route, count]) => ({ route, count })).sort((a,b) => b.count - a.count),
        recentTrips: myTrips.slice(0, 10),
        allExpenses: myExpenses
      });
    }

    // Company dashboard
    const totalTrips    = queryGet('SELECT COUNT(*) as cnt FROM trips').cnt;
    const totalRevenue  = queryGet('SELECT COALESCE(SUM(total_amount),0) as total FROM invoices').total;
    const totalExpenses = queryGet(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE status='Approved'`).total;
    const vehicleCount  = queryGet('SELECT COUNT(*) as cnt FROM vehicles').cnt;
    const activeTrips   = queryGet(`SELECT COUNT(*) as cnt FROM trips WHERE status IN ('Dispatched','In Transit')`).cnt;
    const pendingTrips  = queryGet(`SELECT COUNT(*) as cnt FROM trips WHERE status='Pending'`).cnt;
    const pendingExp    = queryGet(`SELECT COUNT(*) as cnt FROM expenses WHERE status='Pending'`).cnt;

    // Vehicle utilization
    const vehicleUtil = queryAll(`
      SELECT v.registration, u.name as driver_name, v.status,
        (SELECT COUNT(*) FROM trips WHERE vehicle_id=v.id) as trips
      FROM vehicles v LEFT JOIN users u ON v.driver_id=u.id
      ORDER BY trips DESC LIMIT 6
    `);

    res.json({
      role, totalTrips, totalRevenue, totalExpenses, vehicleCount, activeTrips, pendingTrips, pendingExp,
      netProfit: totalRevenue - totalExpenses,
      cargoStats:    queryAll(`SELECT cargo_type, COUNT(*) as count FROM trips GROUP BY cargo_type ORDER BY count DESC LIMIT 5`),
      routeStats:    queryAll(`SELECT t.pickup || ' → ' || t.destination as route, COUNT(*) as trip_count, COALESCE(SUM(i.total_amount),0) as revenue, COALESCE(SUM(e.total_exp),0) as expenses FROM trips t LEFT JOIN invoices i ON i.trip_id=t.id LEFT JOIN (SELECT trip_id, SUM(amount) as total_exp FROM expenses WHERE status='Approved' GROUP BY trip_id) e ON e.trip_id=t.id GROUP BY route ORDER BY revenue DESC LIMIT 5`),
      tripsByStatus: queryAll(`SELECT status, COUNT(*) as count FROM trips GROUP BY status`),
      expenseByType: queryAll(`SELECT expense_type, SUM(amount) as total FROM expenses WHERE status='Approved' GROUP BY expense_type`),
      recentTrips:   queryAll(`SELECT t.*, v.registration, cu.name as customer_name, du.name as driver_name FROM trips t LEFT JOIN vehicles v ON t.vehicle_id=v.id LEFT JOIN users cu ON t.customer_id=cu.id LEFT JOIN users du ON t.driver_id=du.id ORDER BY t.created_at DESC LIMIT 8`),
      vehicleUtil,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS (Daily / Weekly / Monthly) - All roles
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/analytics', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    const { period } = req.query; // 'daily', 'weekly', 'monthly' (default: monthly)

    // Determine date grouping
    let dateGroup, dateFormat;
    if (period === 'daily') {
      dateGroup = `date(t.booking_date)`;
      dateFormat = 'day';
    } else if (period === 'weekly') {
      dateGroup = `strftime('%Y-W%W', t.booking_date)`;
      dateFormat = 'week';
    } else {
      dateGroup = `strftime('%Y-%m', t.booking_date)`;
      dateFormat = 'month';
    }

    // Base filter by role
    let tripFilter = '1=1';
    let expFilter = '1=1';
    let invFilter = '1=1';
    const params = [];
    if (role === 'customer') {
      tripFilter = `t.customer_id='${String(id).replace(/'/g, "''")}'`;
      expFilter = `t2.customer_id='${String(id).replace(/'/g, "''")}'`;
      invFilter = `i.customer_id='${String(id).replace(/'/g, "''")}'`;
    } else if (role === 'driver') {
      tripFilter = `t.driver_id='${String(id).replace(/'/g, "''")}'`;
      expFilter = `e.submitted_by='${String(id).replace(/'/g, "''")}'`;
      invFilter = '1=0'; // Drivers don't see invoices
    }

    // Trip trends by period
    const tripTrends = queryAll(`
      SELECT ${dateGroup} as period, COUNT(*) as trips,
        SUM(t.distance) as total_distance
      FROM trips t WHERE ${tripFilter} AND t.booking_date IS NOT NULL
      GROUP BY period ORDER BY period DESC LIMIT 30
    `);

    // Revenue trends
    const revenueTrends = queryAll(`
      SELECT strftime(${period === 'daily' ? "'%Y-%m-%d'" : period === 'weekly' ? "'%Y-W%W'" : "'%Y-%m'"}, i.created_at) as period,
        SUM(i.total_amount) as revenue, COUNT(*) as invoice_count
      FROM invoices i WHERE ${invFilter} AND i.created_at IS NOT NULL
      GROUP BY period ORDER BY period DESC LIMIT 30
    `);

    // Expense trends
    const expenseTrends = queryAll(`
      SELECT strftime(${period === 'daily' ? "'%Y-%m-%d'" : period === 'weekly' ? "'%Y-W%W'" : "'%Y-%m'"}, e.date) as period,
        SUM(e.amount) as total_expenses, COUNT(*) as expense_count
      FROM expenses e
      ${role === 'customer' ? 'JOIN trips t2 ON e.trip_id=t2.id' : ''}
      WHERE ${role === 'customer' ? expFilter : role === 'driver' ? expFilter : "e.status='Approved'"}
      GROUP BY period ORDER BY period DESC LIMIT 30
    `);

    // Status breakdown
    let statusSql = `SELECT status, COUNT(*) as count FROM trips t WHERE ${tripFilter} GROUP BY status`;
    const statusBreakdown = queryAll(statusSql);

    // Expense by type
    let expTypeSql = `SELECT e.expense_type, SUM(e.amount) as total, COUNT(*) as count FROM expenses e`;
    if (role === 'customer') expTypeSql += ` JOIN trips t2 ON e.trip_id=t2.id WHERE ${expFilter}`;
    else if (role === 'driver') expTypeSql += ` WHERE ${expFilter}`;
    else expTypeSql += ` WHERE e.status='Approved'`;
    expTypeSql += ` GROUP BY e.expense_type`;
    const expenseByType = queryAll(expTypeSql);

    // Top routes
    const topRoutes = queryAll(`
      SELECT t.pickup || ' → ' || t.destination as route, COUNT(*) as trips, SUM(t.distance) as total_distance
      FROM trips t WHERE ${tripFilter}
      GROUP BY route ORDER BY trips DESC LIMIT 5
    `);

    // Cargo stats
    const cargoStats = queryAll(`
      SELECT cargo_type, COUNT(*) as count FROM trips t WHERE ${tripFilter}
      GROUP BY cargo_type ORDER BY count DESC
    `);

    res.json({
      period: dateFormat,
      tripTrends: tripTrends.reverse(),
      revenueTrends: revenueTrends.reverse(),
      expenseTrends: expenseTrends.reverse(),
      statusBreakdown,
      expenseByType,
      topRoutes,
      cargoStats
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REPORTS & DOWNLOADS (Excel + CSV)
  // ══════════════════════════════════════════════════════════════════════════

  // Expense report - Excel download
  app.get('/api/reports/expenses', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    const { trip_id, from, to, format } = req.query;
    let sql = `SELECT e.*, t.pickup, t.destination, u.name as driver_name FROM expenses e LEFT JOIN trips t ON e.trip_id=t.id LEFT JOIN users u ON e.submitted_by=u.id WHERE 1=1`;
    const params = [];
    if (role === 'driver') { sql += ` AND e.submitted_by=?`; params.push(id); }
    if (role === 'customer') { sql += ` AND t.customer_id=?`; params.push(id); }
    if (trip_id) { sql += ` AND e.trip_id=?`; params.push(trip_id); }
    if (from)    { sql += ` AND e.date >= ?`; params.push(from); }
    if (to)      { sql += ` AND e.date <= ?`; params.push(to); }
    sql += ` ORDER BY e.date DESC`;
    const rows = queryAll(sql, params);

    const data = rows.map(r => ({
      'Date': r.date,
      'Route': `${r.pickup || ''} → ${r.destination || ''}`,
      'Driver': r.driver_name || '',
      'Type': r.expense_type,
      'Amount (INR)': r.amount,
      'Notes': r.notes || '',
      'Status': r.status
    }));

    if (format === 'csv') {
      let csv = Object.keys(data[0] || {}).join(',') + '\n';
      data.forEach(r => { csv += Object.values(r).map(v => `"${String(v).replace(/"/g, '')}"`).join(',') + '\n'; });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="expense-report.csv"');
      return res.send(csv);
    }

    // Default: Excel
    const buffer = generateExcel(data, 'Expenses');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="expense-report.xlsx"');
    res.send(Buffer.from(buffer));
  });

  // Trip report - Excel download
  app.get('/api/reports/trips', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    const { format } = req.query;
    let sql = `SELECT t.*, cu.name as customer_name, du.name as driver_name, v.registration,
      COALESCE(i.total_amount,0) as invoice_amount,
      COALESCE(ex.total_exp,0) as total_expenses
      FROM trips t
      LEFT JOIN users cu ON t.customer_id=cu.id
      LEFT JOIN users du ON t.driver_id=du.id
      LEFT JOIN vehicles v ON t.vehicle_id=v.id
      LEFT JOIN invoices i ON i.trip_id=t.id
      LEFT JOIN (SELECT trip_id, SUM(amount) as total_exp FROM expenses WHERE status='Approved' GROUP BY trip_id) ex ON ex.trip_id=t.id
      WHERE 1=1`;
    const params = [];
    if (role === 'customer') { sql += ` AND t.customer_id=?`; params.push(id); }
    if (role === 'driver')   { sql += ` AND t.driver_id=?`; params.push(id); }
    sql += ` ORDER BY t.created_at DESC`;
    const rows = queryAll(sql, params);

    const data = rows.map(r => ({
      'Trip ID': r.id.slice(0, 8),
      'Customer': r.customer_name || '',
      'Driver': r.driver_name || '',
      'Vehicle': r.registration || '',
      'Pickup': r.pickup,
      'Destination': r.destination,
      'Distance (km)': r.distance,
      'Cargo': r.cargo_type,
      'Status': r.status,
      'Invoice Amount': r.invoice_amount,
      'Expenses': r.total_expenses,
      'Profit': r.invoice_amount - r.total_expenses,
      'Booking Date': r.booking_date || r.created_at
    }));

    if (format === 'csv') {
      let csv = Object.keys(data[0] || {}).join(',') + '\n';
      data.forEach(r => { csv += Object.values(r).map(v => `"${String(v).replace(/"/g, '')}"`).join(',') + '\n'; });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="trip-report.csv"');
      return res.send(csv);
    }

    const buffer = generateExcel(data, 'Trips');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="trip-report.xlsx"');
    res.send(Buffer.from(buffer));
  });

  // Analytics report - Excel download (combined summary)
  app.get('/api/reports/analytics', authMiddleware, (req, res) => {
    const { role, id } = req.user;
    const { period } = req.query;

    // Build trip data based on role
    let tripSql = `SELECT t.*, cu.name as customer_name, du.name as driver_name, v.registration,
      COALESCE(i.total_amount,0) as invoice_amount,
      COALESCE(ex.total_exp,0) as total_expenses
      FROM trips t
      LEFT JOIN users cu ON t.customer_id=cu.id
      LEFT JOIN users du ON t.driver_id=du.id
      LEFT JOIN vehicles v ON t.vehicle_id=v.id
      LEFT JOIN invoices i ON i.trip_id=t.id
      LEFT JOIN (SELECT trip_id, SUM(amount) as total_exp FROM expenses WHERE status='Approved' GROUP BY trip_id) ex ON ex.trip_id=t.id
      WHERE 1=1`;
    const params = [];
    if (role === 'customer') { tripSql += ` AND t.customer_id=?`; params.push(id); }
    if (role === 'driver')   { tripSql += ` AND t.driver_id=?`; params.push(id); }
    tripSql += ` ORDER BY t.created_at DESC`;
    const trips = queryAll(tripSql, params);

    // Sheet 1: Trip Summary
    const tripData = trips.map(r => ({
      'Trip ID': r.id.slice(0, 8),
      'Booking Date': r.booking_date || r.created_at,
      'Route': `${r.pickup} → ${r.destination}`,
      'Customer': r.customer_name || '',
      'Driver': r.driver_name || '',
      'Vehicle': r.registration || '',
      'Distance (km)': r.distance,
      'Cargo': r.cargo_type,
      'Status': r.status,
      'Revenue (INR)': r.invoice_amount,
      'Expenses (INR)': r.total_expenses,
      'Profit (INR)': r.invoice_amount - r.total_expenses
    }));

    // Sheet 2: Expense Detail
    let expSql = `SELECT e.*, t.pickup, t.destination, u.name as submitted_by_name FROM expenses e LEFT JOIN trips t ON e.trip_id=t.id LEFT JOIN users u ON e.submitted_by=u.id WHERE 1=1`;
    const expParams = [];
    if (role === 'driver') { expSql += ` AND e.submitted_by=?`; expParams.push(id); }
    if (role === 'customer') { expSql += ` AND t.customer_id=?`; expParams.push(id); }
    expSql += ` ORDER BY e.date DESC`;
    const expRows = queryAll(expSql, expParams);

    const expData = expRows.map(r => ({
      'Date': r.date,
      'Route': `${r.pickup || ''} → ${r.destination || ''}`,
      'Type': r.expense_type,
      'Amount (INR)': r.amount,
      'Submitted By': r.submitted_by_name || '',
      'Status': r.status,
      'Notes': r.notes || ''
    }));

    // Sheet 3: Summary KPIs
    const totalRevenue = trips.reduce((s, t) => s + t.invoice_amount, 0);
    const totalExp = trips.reduce((s, t) => s + t.total_expenses, 0);
    const summaryData = [
      { 'Metric': 'Total Trips', 'Value': trips.length },
      { 'Metric': 'Total Revenue', 'Value': totalRevenue },
      { 'Metric': 'Total Expenses', 'Value': totalExp },
      { 'Metric': 'Net Profit', 'Value': totalRevenue - totalExp },
      { 'Metric': 'Avg Trip Distance (km)', 'Value': trips.length ? Math.round(trips.reduce((s,t)=>s+t.distance,0)/trips.length) : 0 },
      { 'Metric': 'Delivered Trips', 'Value': trips.filter(t=>['Delivered','Returned'].includes(t.status)).length },
      { 'Metric': 'Pending Trips', 'Value': trips.filter(t=>t.status==='Pending').length },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripData.length ? tripData : [{'No Data': 'No trips found'}]), 'Trips');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expData.length ? expData : [{'No Data': 'No expenses found'}]), 'Expenses');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.xlsx"');
    res.send(Buffer.from(buffer));
  });

  // Invoice PDF (HTML)
  app.get('/api/reports/invoice/:id', authMiddleware, (req, res) => {
    const inv = queryGet('SELECT i.*, t.pickup, t.destination, t.cargo_type, t.distance, t.driver_id, cu.name as cname, cu.company as ccompany FROM invoices i LEFT JOIN trips t ON i.trip_id=t.id LEFT JOIN users cu ON i.customer_id=cu.id WHERE i.id=?', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const expenses = queryAll(`SELECT * FROM expenses WHERE trip_id=? AND status='Approved'`, [inv.trip_id]);
    const totalExp = expenses.reduce((s,e) => s + e.amount, 0);
    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Invoice ${inv.id.slice(0,8).toUpperCase()}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#1a1a2e;padding:20px;}
      .header{display:flex;justify-content:space-between;border-bottom:3px solid #f59e0b;padding-bottom:20px;margin-bottom:24px;}
      .logo{font-size:24px;font-weight:900;color:#f59e0b;letter-spacing:2px;}
      .inv-no{font-size:13px;color:#666;font-family:monospace;}
      table{width:100%;border-collapse:collapse;margin:20px 0;}
      th{background:#f59e0b;color:#000;padding:10px;text-align:left;font-size:12px;letter-spacing:1px;}
      td{padding:10px;border-bottom:1px solid #eee;font-size:13px;}
      .total-row td{font-weight:bold;background:#fef3c7;font-size:15px;}
      .profit-box{background:#ecfdf5;border:1px solid #10b981;border-radius:6px;padding:16px;margin-top:20px;display:flex;justify-content:space-between;}
      .footer{margin-top:40px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:16px;}
      @media print{body{margin:0;}}
    </style></head><body>
    <div class="header">
      <div><div class="logo">GOVFLEET</div><div style="font-size:11px;color:#666;">State Transport Management</div></div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:bold;">FREIGHT INVOICE</div>
        <div class="inv-no">#${inv.id.slice(0,8).toUpperCase()}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">${new Date(inv.created_at).toLocaleDateString('en-IN',{dateStyle:'long'})}</div>
      </div>
    </div>
    <table><tr><td width="50%"><strong>BILL TO</strong><br/>${inv.cname||inv.customer_name}<br/>${inv.ccompany||''}</td>
    <td><strong>ROUTE</strong><br/>${inv.pickup} → ${inv.destination}<br/><span style="font-size:12px;color:#666;">${inv.cargo_type} &bull; ${inv.distance} km</span></td></tr></table>
    <table><thead><tr><th>Description</th><th>Distance</th><th>Rate (INR/km)</th><th>Amount</th></tr></thead>
    <tbody>
    <tr><td>Freight Charges - ${inv.pickup} to ${inv.destination}<br/><span style="font-size:11px;color:#666;">Cargo: ${inv.cargo_type}</span></td>
    <td style="font-family:monospace">${inv.distance} km</td>
    <td style="font-family:monospace">INR ${inv.freight_rate}</td>
    <td style="font-family:monospace;color:#10b981;font-weight:bold;">${fmt(inv.total_amount)}</td></tr>
    </tbody><tfoot><tr class="total-row"><td colspan="3">TOTAL AMOUNT</td><td style="font-family:monospace;color:#10b981">${fmt(inv.total_amount)}</td></tr></tfoot></table>
    ${expenses.length ? `<table><thead><tr><th>Expense Type</th><th>Date</th><th>Notes</th><th>Amount</th></tr></thead><tbody>
    ${expenses.map(e=>`<tr><td>${e.expense_type}</td><td>${e.date}</td><td>${e.notes||''}</td><td style="font-family:monospace;color:#ef4444">-${fmt(e.amount)}</td></tr>`).join('')}
    </tbody></table>` : ''}
    <div class="profit-box">
      <div><strong>NET PROFIT</strong><br/><span style="font-size:12px;color:#666;">Revenue - Approved Expenses</span></div>
      <div style="font-size:24px;font-weight:bold;color:${inv.total_amount - totalExp >= 0 ? '#10b981':'#ef4444'};font-family:monospace;">${fmt(inv.total_amount - totalExp)}</div>
    </div>
    <div class="footer">GovFleet Logistics &bull; State Transport Management System &bull; Generated ${new Date().toLocaleString('en-IN')}<br/>This is a computer-generated document.</div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Download all trip documents as zip
  app.get('/api/trips/:id/documents/download', authMiddleware, (req, res) => {
    const docs = queryAll('SELECT * FROM documents WHERE trip_id=?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'No documents found' });
    const trip = queryGet('SELECT pickup, destination FROM trips WHERE id=?', [req.params.id]);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="trip-${req.params.id.slice(0,8)}-docs.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    docs.forEach(doc => {
      const fp = path.join(UPLOADS_DIR, doc.filename);
      if (fs.existsSync(fp)) archive.file(fp, { name: `${doc.doc_type}-${doc.original_name}` });
    });
    archive.finalize();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SERVE REACT BUILD
  // ══════════════════════════════════════════════════════════════════════════
  const buildPath = path.join(__dirname, '../frontend/build');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
  }

  const port = process.env.PORT || 3001;
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚛 Fleet Tracker API running on port ${port}`);
  });
}

startServer();
