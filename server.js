const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('public'));

// Database
const dbPath = './campaigns.db';
const db = new sqlite3.Database(dbPath);

// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    propertyAddress TEXT,
    propertyPrice TEXT,
    propertyType TEXT,
    createdAt DATETIME
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY,
    name TEXT,
    subject TEXT,
    html TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS smtpSettings (
    id INTEGER PRIMARY KEY,
    host TEXT,
    port INTEGER,
    secure BOOLEAN,
    user TEXT,
    pass TEXT,
    company TEXT,
    email TEXT,
    phone TEXT
  )`);

  db.run(`INSERT OR IGNORE INTO templates (id, name, subject, html) 
    VALUES (1, 'Default', 'Hello {{firstName}}', '<h1>Hello {{firstName}}</h1><p>Property: {{propertyAddress}}</p>')`);
  
  db.run(`INSERT OR IGNORE INTO smtpSettings (id, host, port, secure) 
    VALUES (1, 'smtp.gmail.com', 587, 0)`);
});

// Helper: DB promisified
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// ==================== LEADS ====================

app.get('/api/leads', async (req, res) => {
  try {
    const leads = await dbAll('SELECT * FROM leads ORDER BY id DESC');
    res.json(leads);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType } = req.body;
    if (!email) return res.json({ success: false, error: 'Email required' });
    
    const now = new Date().toISOString();
    await dbRun(
      'INSERT INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName || '', lastName || '', email, phone || '', propertyAddress || '', propertyPrice || '', propertyType || '', now]
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// ==================== UPLOAD ====================

app.post('/api/leads/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    const fileName = req.file.originalname.toLowerCase();
    let rows = [];

    if (fileName.endsWith('.csv')) {
      rows = parse(req.file.buffer.toString('utf-8'), { 
        columns: true, 
        skip_empty_lines: true 
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    if (!rows || rows.length === 0) {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    // Map columns
    const mapCol = (name) => {
      const n = name.toLowerCase().trim();
      if (n.includes('first')) return 'firstName';
      if (n.includes('last')) return 'lastName';
      if (n.includes('email')) return 'email';
      if (n.includes('phone')) return 'phone';
      if (n.includes('address')) return 'propertyAddress';
      if (n.includes('price')) return 'propertyPrice';
      if (n.includes('type')) return 'propertyType';
      return null;
    };

    const colMap = {};
    const headers = Object.keys(rows[0] || {});
    headers.forEach(col => {
      const mapped = mapCol(col);
      if (mapped) colMap[col] = mapped;
    });

    if (!Object.values(colMap).includes('email')) {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    let inserted = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      try {
        const lead = {};
        Object.keys(colMap).forEach(col => {
          lead[colMap[col]] = (row[col] || '').toString().trim();
        });

        if (!lead.email) {
          failed++;
          continue;
        }

        await dbRun(
          'INSERT OR IGNORE INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            lead.firstName || '',
            lead.lastName || '',
            lead.email,
            lead.phone || '',
            lead.propertyAddress || '',
            lead.propertyPrice || '',
            lead.propertyType || '',
            now
          ]
        );
        inserted++;
      } catch (e) {
        failed++;
      }
    }

    res.json({ success: true, inserted, failed });
  } catch (error) {
    res.json({ success: false, inserted: 0, failed: 0 });
  }
});

// ==================== TEMPLATES ====================

app.get('/api/templates', async (req, res) => {
  try {
    const templates = await dbAll('SELECT * FROM templates');
    res.json(templates);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/templates/:id', async (req, res) => {
  try {
    const template = await dbGet('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    res.json(template || {});
  } catch (e) {
    res.json({});
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { id, name, subject, html } = req.body;
    
    if (id) {
      await dbRun('UPDATE templates SET name = ?, subject = ?, html = ? WHERE id = ?', 
        [name, subject, html, id]);
    } else {
      await dbRun('INSERT INTO templates (name, subject, html) VALUES (?, ?, ?)', 
        [name, subject, html]);
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ==================== SMTP ====================

app.get('/api/smtp-settings', async (req, res) => {
  try {
    const settings = await dbGet('SELECT * FROM smtpSettings WHERE id = 1');
    res.json(settings || {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      company: '',
      email: '',
      phone: ''
    });
  } catch (e) {
    res.json({});
  }
});

app.post('/api/smtp-settings', async (req, res) => {
  try {
    const { host, port, secure, user, pass, company, email, phone } = req.body;
    
    await dbRun(
      'INSERT OR REPLACE INTO smtpSettings (id, host, port, secure, user, pass, company, email, phone) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)',
      [host, port, secure ? 1 : 0, user, pass, company, email, phone]
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ==================== SMTP TEST ====================

app.post('/api/smtp-test', async (req, res) => {
  try {
    const settings = await dbGet('SELECT * FROM smtpSettings WHERE id = 1');
    
    if (!settings || !settings.host || !settings.user || !settings.pass) {
      return res.json({ success: false, error: 'Settings incomplete' });
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure === 1,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    });

    const verified = await transporter.verify();
    if (verified) {
      res.json({ success: true, message: 'SMTP connection successful' });
    } else {
      res.json({ success: false, error: 'Verification failed' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ==================== TEST EMAIL ====================

app.post('/api/smtp-test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, error: 'Email required' });

    const settings = await dbGet('SELECT * FROM smtpSettings WHERE id = 1');
    
    if (!settings || !settings.user || !settings.pass) {
      return res.json({ success: false, error: 'SMTP not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure === 1,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    });

    await transporter.sendMail({
      from: settings.user,
      to: email,
      subject: 'Test Email',
      html: '<h1>Test Successful!</h1><p>Your SMTP is working correctly.</p>'
    });

    res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ==================== SEND CAMPAIGN ====================

app.post('/api/campaigns/send', async (req, res) => {
  try {
    const { templateId, subject, zoomLink, meetingDate, meetingTime } = req.body;
    
    const template = await dbGet('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!template) return res.json({ success: false, error: 'Template not found' });

    const leads = await dbAll('SELECT * FROM leads');
    if (leads.length === 0) return res.json({ success: false, error: 'No leads' });

    const settings = await dbGet('SELECT * FROM smtpSettings WHERE id = 1');
    if (!settings || !settings.user || !settings.pass) {
      return res.json({ success: false, error: 'SMTP not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure === 1,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    });

    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        let html = template.html;
        html = html.replace(/{{firstName}}/g, lead.firstName || '');
        html = html.replace(/{{lastName}}/g, lead.lastName || '');
        html = html.replace(/{{propertyAddress}}/g, lead.propertyAddress || '');
        html = html.replace(/{{propertyPrice}}/g, lead.propertyPrice || '');
        html = html.replace(/{{propertyType}}/g, lead.propertyType || '');
        html = html.replace(/{{zoomLink}}/g, zoomLink || '');
        html = html.replace(/{{meetingDate}}/g, meetingDate || '');
        html = html.replace(/{{meetingTime}}/g, meetingTime || '');

        let subj = template.subject;
        subj = subj.replace(/{{firstName}}/g, lead.firstName || '');
        subj = subj.replace(/{{propertyAddress}}/g, lead.propertyAddress || '');

        await transporter.sendMail({
          from: settings.user,
          to: lead.email,
          subject: subj,
          html: html
        });

        sent++;
      } catch (e) {
        failed++;
      }
    }

    res.json({ success: true, sent, failed, total: leads.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}\n`);
});
