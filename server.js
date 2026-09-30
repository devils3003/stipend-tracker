import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 5000;

// Resolve directory path for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database Connection
const dbPath = path.resolve(__dirname, 'stipends.db');
const db = new Database(dbPath);

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

// Automatically create missing tables and seed default stipend types
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    "Staff ID" TEXT PRIMARY KEY,
    "First Name" TEXT,
    "Last Name" TEXT,
    "Position" TEXT,
    "Active" TEXT
  );

  CREATE TABLE IF NOT EXISTS stipend_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    default_rate REAL
  );

  CREATE TABLE IF NOT EXISTS employee_stipends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT,
    stipend_type_id INTEGER,
    quantity INTEGER,
    custom_rate REAL,
    effective_date TEXT
  );

  INSERT OR IGNORE INTO stipend_types (id, name, default_rate) VALUES 
    (1, 'Route Stipend', 18.00),
    (2, 'Special Ed Route', 20.00),
    (3, 'Field Trip', 18.00),
    (4, 'Sub / Extra Duty', 18.00);
`);

// --- GET ROUTES ---

// Get all employees
app.get('/api/employees', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM employees').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all stipend types
app.get('/api/stipend-types', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM stipend_types').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employee stipends
app.get('/api/employee-stipends', (req, res) => {
  try {
    const sql = `
      SELECT es.*, 
             e."First Name" as emp_first, e."Last Name" as emp_last,
             st.name as stipend_type_name
      FROM employee_stipends es
      LEFT JOIN employees e ON es.staff_id = e."Staff ID"
      LEFT JOIN stipend_types st ON es.stipend_type_id = st.id
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post bulk employee stipends
app.post('/api/employee-stipends', (req, res) => {
  const stipends = req.body;
  if (!Array.isArray(stipends) || stipends.length === 0) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO employee_stipends (staff_id, stipend_type_id, quantity, custom_rate, effective_date) 
      VALUES (?, ?, ?, ?, ?)
    `);

    // Execute bulk insert inside a transaction for efficiency
    const insertMany = db.transaction((items) => {
      for (const s of items) {
        insertStmt.run(s.staff_id, s.stipend_type_id, s.quantity, s.custom_rate, s.effective_date);
      }
    });

    insertMany(stipends);
    res.json({ message: 'Stipends recorded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW ACTION ROUTES ---

// 1. Delete a Stipend Entry
app.delete('/api/employee-stipends/:id', (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM employee_stipends WHERE id = ?');
    const result = stmt.run(id);
    res.json({ message: 'Deleted successfully', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add a New Staff Member
app.post('/api/employees', (req, res) => {
  const { staffId, firstName, lastName, position, active } = req.body;
  try {
    const sql = `INSERT INTO employees ("Staff ID", "First Name", "Last Name", "Position", "Active") VALUES (?, ?, ?, ?, ?)`;
    const stmt = db.prepare(sql);
    const result = stmt.run(staffId, firstName, lastName, position, active);
    res.json({ message: 'Employee added successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Local Server
app.listen(PORT, () => {
  console.log(`Local Express server running on http://localhost:${PORT}`);
});