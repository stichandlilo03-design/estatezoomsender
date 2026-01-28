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

// Database - Using file-based for Vercel
const dbPath = process.env.SQLITE_PATH || './campaigns.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ DB Error:', err);
  else console.log('✅ Database ready at', dbPath);
});

// Create tables
db.serialize(() => {
  // Leads table
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    propertyAddress TEXT,
    propertyPrice TEXT,
    propertyType TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Email templates table
  db.run(`CREATE TABLE IF NOT EXISTS emailTemplates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    subject TEXT,
    htmlContent TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Campaigns table - TRACK SENDING
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaignName TEXT,
    templateId INTEGER,
    leadCount INTEGER,
    sentCount INTEGER DEFAULT 0,
    failureCount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    startedAt DATETIME,
    completedAt DATETIME
  )`);

  // Campaign logs - DETAILED TRACKING
  db.run(`CREATE TABLE IF NOT EXISTS campaignLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaignId INTEGER,
    leadId INTEGER,
    leadEmail TEXT,
    status TEXT,
    message TEXT,
    sentAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // SMTP settings table
  db.run(`CREATE TABLE IF NOT EXISTS smtpSettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    smtpHost TEXT,
    smtpPort INTEGER,
    smtpSecure BOOLEAN,
    emailUser TEXT,
    emailPassword TEXT,
    companyName TEXT,
    companyEmail TEXT,
    companyPhone TEXT
  )`);

  // Insert default template if not exists
  const defaultTemplate = `<html><body style="font-family: Arial; background: #f4f4f4;"><table width="100%"><tr><td align="center" style="padding: 20px;"><table width="600" style="background: white; border-radius: 8px;"><tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;"><h1>Great News!</h1></td></tr><tr><td style="padding: 40px;"><p>Hi {{firstName}},</p><p>We have exciting news about your property at {{propertyAddress}}!</p><p>Valued at: {{propertyPrice}}</p><p>Type: {{propertyType}}</p><p>Let's schedule a meeting to discuss this amazing opportunity!</p><p><strong>Date:</strong> {{meetingDate}}<br><strong>Time:</strong> {{meetingTime}}</p><p><a href="{{zoomLink}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Join Zoom Meeting</a></p><p>Best regards,<br>{{companyName}}<br>{{companyPhone}}</p></td></tr></table></td></tr></table></body></html>`;
  
  db.run(`INSERT OR IGNORE INTO emailTemplates (id, name, subject, htmlContent) VALUES (1, 'Default Template', 'Property Update: {{propertyAddress}}', ?)`, [defaultTemplate]);
  db.run(`INSERT OR IGNORE INTO smtpSettings (id, smtpHost, smtpPort) VALUES (1, 'smtp.gmail.com', 587)`);
});

let emailTransporter = null;

// ==================== HELPER FUNCTIONS ====================
function getEmailTransporter() {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM smtpSettings WHERE id = 1', (err, settings) => {
      if (err) return reject(err);
      if (!settings || !settings.emailUser || !settings.emailPassword) {
        return reject(new Error('SMTP settings not configured'));
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure === 1 || settings.smtpSecure === true,
        auth: {
          user: settings.emailUser,
          pass: settings.emailPassword
        }
      });

      resolve({ transporter, settings });
    });
  });
}

function replaceVariables(template, data) {
  let content = template;
  content = content.replace(/{{firstName}}/g, data.firstName || '');
  content = content.replace(/{{lastName}}/g, data.lastName || '');
  content = content.replace(/{{email}}/g, data.email || '');
  content = content.replace(/{{phone}}/g, data.phone || '');
  content = content.replace(/{{propertyAddress}}/g, data.propertyAddress || '');
  content = content.replace(/{{propertyPrice}}/g, data.propertyPrice || '');
  content = content.replace(/{{propertyType}}/g, data.propertyType || '');
  content = content.replace(/{{zoomLink}}/g, data.zoomLink || '');
  content = content.replace(/{{meetingDate}}/g, data.meetingDate || '');
  content = content.replace(/{{meetingTime}}/g, data.meetingTime || '');
  content = content.replace(/{{companyName}}/g, data.companyName || '');
  content = content.replace(/{{companyPhone}}/g, data.companyPhone || '');
  return content;
}

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
  
  db.run(
    `INSERT INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [firstName || '', lastName || '', email, phone || '', propertyAddress || '', propertyPrice || '', propertyType || ''],
    function(err) {
      if (err) return res.status(400).json({ success: false, error: 'Email already exists' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// DELETE Lead
app.delete('/api/leads/:id', (req, res) => {
  db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function(err) {
    res.json({ success: !err });
  });
});

// FILE UPLOAD - CSV/EXCEL
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No file' });

    const fileName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;
    let rows = [];

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
      res.json({ success: true, inserted, failed, total: rows.length });
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

// POST/UPDATE Template
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

// POST SMTP Settings & Test
app.post('/api/smtp-settings', (req, res) => {
  const { smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO smtpSettings (id, smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [smtpHost, smtpPort, smtpSecure ? 1 : 0, emailUser, emailPassword, companyName, companyEmail, companyPhone],
    function(err) {
      res.json({ success: !err });
    }
  );
});

// TEST SMTP Connection
app.post('/api/smtp-test', async (req, res) => {
  try {
    const { transporter } = await getEmailTransporter();
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// SEND TEST EMAIL
app.post('/api/smtp-test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const { transporter, settings } = await getEmailTransporter();

    await transporter.sendMail({
      from: settings.emailUser,
      to: email,
      subject: 'Test Email from Campaign Manager',
      html: `<h1>Success!</h1><p>This is a test email from your Email Campaign Manager.</p><p>If you received this, your SMTP settings are working correctly!</p>`
    });

    res.json({ success: true, message: 'Test email sent' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// SEND CAMPAIGN - REAL EMAIL SENDING
app.post('/api/campaigns/send', async (req, res) => {
  try {
    const { templateId, leadIds, campaignName, zoomLink, meetingDate, meetingTime } = req.body;

    if (!templateId) return res.status(400).json({ success: false, error: 'Template required' });
    if (!leadIds || leadIds.length === 0) return res.status(400).json({ success: false, error: 'No leads selected' });

    // Get template
    const template = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM emailTemplates WHERE id = ?', [templateId], (err, tmpl) => {
        if (err) reject(err);
        else resolve(tmpl);
      });
    });

    if (!template) return res.status(400).json({ success: false, error: 'Template not found' });

    // Get SMTP settings
    const { transporter, settings } = await getEmailTransporter();

    // Create campaign record
    const campaignId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO campaigns (campaignName, templateId, leadCount, status, startedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [campaignName || 'Campaign', templateId, leadIds.length],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Send emails
    let sentCount = 0;
    let failureCount = 0;

    for (const leadId of leadIds) {
      try {
        const lead = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM leads WHERE id = ?', [leadId], (err, l) => {
            if (err) reject(err);
            else resolve(l);
          });
        });

        if (!lead) continue;

        // Replace variables
        const subject = replaceVariables(template.subject, { ...lead, zoomLink, meetingDate, meetingTime, companyName: settings.companyName });
        const html = replaceVariables(template.htmlContent, { ...lead, zoomLink, meetingDate, meetingTime, companyName: settings.companyName, companyPhone: settings.companyPhone });

        // Send email
        await transporter.sendMail({
          from: settings.emailUser,
          to: lead.email,
          subject: subject,
          html: html
        });

        sentCount++;

        // Log success
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO campaignLogs (campaignId, leadId, leadEmail, status, message) VALUES (?, ?, ?, ?, ?)`,
            [campaignId, leadId, lead.email, 'success', 'Email sent successfully'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

      } catch (emailErr) {
        failureCount++;
        
        // Log failure
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO campaignLogs (campaignId, leadId, leadEmail, status, message) VALUES (?, ?, ?, ?, ?)`,
            [campaignId, '', '', 'failed', emailErr.message],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    // Update campaign status
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE campaigns SET sentCount = ?, failureCount = ?, status = 'completed', completedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [sentCount, failureCount, campaignId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true, campaignId, sentCount, failureCount, total: leadIds.length });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Campaign Log
app.get('/api/campaigns/:id/logs', (req, res) => {
  db.all(
    'SELECT * FROM campaignLogs WHERE campaignId = ? ORDER BY sentAt DESC',
    [req.params.id],
    (err, logs) => {
      res.json(logs || []);
    }
  );
});

// GET Campaigns
app.get('/api/campaigns', (req, res) => {
  db.all(
    'SELECT * FROM campaigns ORDER BY createdAt DESC LIMIT 50',
    (err, campaigns) => {
      res.json(campaigns || []);
    }
  );
});

// GET Campaign Stats
app.get('/api/campaigns/stats', (req, res) => {
  db.all('SELECT SUM(sentCount) as totalSent, SUM(failureCount) as totalFailed, COUNT(*) as campaigns FROM campaigns', (err, stats) => {
    const row = (stats && stats[0]) || {};
    res.json({
      totalSent: row.totalSent || 0,
      totalFailed: row.totalFailed || 0,
      campaigns: row.campaigns || 0
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log('✅ All endpoints ready\n');
});
