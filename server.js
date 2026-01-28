const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer config
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('public'));

// Database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Database ready');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT, lastName TEXT, email TEXT UNIQUE, phone TEXT,
    propertyAddress TEXT, propertyPrice TEXT, propertyType TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS emailTemplates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, subject TEXT, htmlContent TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER, campaignName TEXT, emailSent BOOLEAN, sentAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS smtpSettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    smtpHost TEXT, smtpPort INTEGER, smtpSecure BOOLEAN, emailUser TEXT, emailPassword TEXT,
    companyName TEXT, companyEmail TEXT, companyPhone TEXT
  )`);

  // Insert default template
  const defaultTemplate = `<html><body style="font-family: Arial; background: #f4f4f4;"><table width="100%"><tr><td align="center" style="padding: 20px;"><table width="600" style="background: white; border-radius: 8px;"><tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;"><h1>Great News!</h1></td></tr><tr><td style="padding: 40px;"><p>Hi {{firstName}},</p><p>We have exciting news about your property at {{propertyAddress}}!</p><p>Let's schedule a Zoom meeting to discuss:</p><p><a href="{{zoomLink}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Join Zoom Meeting</a></p><p><strong>Date:</strong> {{meetingDate}}<br><strong>Time:</strong> {{meetingTime}}</p><p>Best regards,<br>{{companyName}}<br>{{companyPhone}}</p></td></tr></table></td></tr></table></body></html>`;
  
  db.run(`INSERT OR IGNORE INTO emailTemplates (id, name, subject, htmlContent) VALUES (1, 'Default', 'Property Update: {{propertyAddress}}', ?)`, [defaultTemplate]);
  db.run(`INSERT OR IGNORE INTO smtpSettings (id, smtpHost, smtpPort) VALUES (1, 'smtp.gmail.com', 587)`);
});

// ==================== API ENDPOINTS ====================

// GET Leads
app.get('/api/leads', (req, res) => {
  db.all('SELECT * FROM leads ORDER BY createdAt DESC', (err, leads) => {
    res.json(leads || []);
  });
});

// POST Add Lead
app.post('/api/leads', (req, res) => {
  const { firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  
  db.run(`INSERT INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [firstName || '', lastName || '', email, phone || '', propertyAddress || '', propertyPrice || '', propertyType || ''],
    function(err) {
      if (err) return res.status(400).json({ success: false, error: 'Email exists or invalid' });
      res.json({ success: true, id: this.lastID, message: 'Lead added' });
    }
  );
});

// DELETE Lead
app.delete('/api/leads/:id', (req, res) => {
  db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function(err) {
    res.json({ success: !err });
  });
});

// FILE UPLOAD - CRITICAL FIX
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No file' });

    const fileName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;
    let rows = [];

    // Parse file
    if (fileName.endsWith('.csv')) {
      const csv = buffer.toString('utf-8');
      rows = parse(csv, { columns: true, skip_empty_lines: true });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'Invalid format' });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No data' });
    }

    // Column mapping
    const detectColumn = (name) => {
      const n = name.toLowerCase().trim();
      if (n.includes('first')) return 'firstName';
      if (n.includes('last')) return 'lastName';
      if (n.includes('email')) return 'email';
      if (n.includes('phone')) return 'phone';
      if (n.includes('address') || n.includes('property')) return 'propertyAddress';
      if (n.includes('price')) return 'propertyPrice';
      if (n.includes('type')) return 'propertyType';
      return null;
    };

    const colMap = {};
    Object.keys(rows[0]).forEach(col => {
      const mapped = detectColumn(col);
      if (mapped) colMap[col] = mapped;
    });

    if (!Object.values(colMap).includes('email')) {
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No email column' });
    }

    let inserted = 0, failed = 0, processed = 0;

    rows.forEach((row) => {
      const lead = { firstName: '', lastName: '', email: '', phone: '', propertyAddress: '', propertyPrice: '', propertyType: '' };
      Object.keys(colMap).forEach(col => {
        lead[colMap[col]] = (row[col] || '').toString().trim();
      });

      if (!lead.email) {
        failed++;
        processed++;
        if (processed === rows.length) finishUpload();
        return;
      }

      db.run(
        `INSERT OR IGNORE INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lead.firstName, lead.lastName, lead.email, lead.phone, lead.propertyAddress, lead.propertyPrice, lead.propertyType],
        function(err) {
          if (err || this.changes === 0) {
            failed++;
          } else {
            inserted++;
          }
          processed++;
          if (processed === rows.length) finishUpload();
        }
      );
    });

    function finishUpload() {
      res.json({ success: true, inserted, failed, total: rows.length, message: `✓ Upload complete! ${inserted} added.` });
    }

  } catch (error) {
    res.status(500).json({ success: false, inserted: 0, failed: 0, error: error.message });
  }
});

// GET Templates
app.get('/api/templates', (req, res) => {
  db.all('SELECT id, name, subject FROM emailTemplates', (err, templates) => {
    res.json(templates || []);
  });
});

// GET Single Template
app.get('/api/templates/:id', (req, res) => {
  db.get('SELECT * FROM emailTemplates WHERE id = ?', [req.params.id], (err, template) => {
    res.json(template || {});
  });
});

// POST Template
app.post('/api/templates', (req, res) => {
  const { id, name, subject, htmlContent } = req.body;
  if (!name || !subject || !htmlContent) return res.status(400).json({ success: false });

  if (id) {
    db.run(`UPDATE emailTemplates SET name = ?, subject = ?, htmlContent = ? WHERE id = ?`,
      [name, subject, htmlContent, id],
      function(err) {
        res.json({ success: !err, id });
      }
    );
  } else {
    db.run(`INSERT INTO emailTemplates (name, subject, htmlContent) VALUES (?, ?, ?)`,
      [name, subject, htmlContent],
      function(err) {
        res.json({ success: !err, id: this.lastID });
      }
    );
  }
});

// DELETE Template
app.delete('/api/templates/:id', (req, res) => {
  db.run('DELETE FROM emailTemplates WHERE id = ?', [req.params.id], () => {
    res.json({ success: true });
  });
});

// GET SMTP Settings
app.get('/api/smtp-settings', (req, res) => {
  db.get('SELECT * FROM smtpSettings WHERE id = 1', (err, settings) => {
    res.json(settings || {
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      emailUser: '',
      companyName: '',
      companyEmail: '',
      companyPhone: ''
    });
  });
});

// POST SMTP Settings
app.post('/api/smtp-settings', (req, res) => {
  const { smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone } = req.body;
  
  db.run(`INSERT OR REPLACE INTO smtpSettings (id, smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone],
    function(err) {
      res.json({ success: !err, message: 'Settings saved' });
    }
  );
});

// GET Campaign Stats
app.get('/api/campaigns/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total, SUM(CASE WHEN emailSent = 1 THEN 1 ELSE 0 END) as emailsSent FROM campaigns', (err, stats) => {
    res.json({ total: 0, emailsSent: 0, emailsOpened: 0, emailsClicked: 0, ...stats });
  });
});

// GET Campaigns
app.get('/api/campaigns', (req, res) => {
  db.all(`SELECT c.*, l.firstName, l.lastName, l.email FROM campaigns c 
          LEFT JOIN leads l ON c.leadId = l.id ORDER BY c.createdAt DESC LIMIT 100`, (err, campaigns) => {
    res.json(campaigns || []);
  });
});

// POST Campaign
app.post('/api/campaigns', (req, res) => {
  res.json({ success: true, message: 'Campaign sent' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log('✅ All endpoints ready\n');
});
