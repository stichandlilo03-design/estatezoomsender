const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for file uploads - use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('public'));

// Database Setup
const dbPath = process.env.SQLITE_PATH || './campaigns.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ Database connection error:', err);
  else console.log('✅ Connected to SQLite database at', dbPath);
});

// Create tables if they don't exist
db.serialize(() => {
  // Leads table
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT,
      lastName TEXT,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      propertyAddress TEXT,
      propertyPrice TEXT,
      propertyType TEXT,
      customData TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Campaigns table
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      campaignName TEXT,
      emailSent BOOLEAN DEFAULT 0,
      sentAt DATETIME,
      opened BOOLEAN DEFAULT 0,
      openedAt DATETIME,
      clicked BOOLEAN DEFAULT 0,
      clickedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(leadId) REFERENCES leads(id)
    )
  `);

  // Email templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS emailTemplates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      htmlContent TEXT NOT NULL,
      isDefault BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SMTP settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS smtpSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      smtpHost TEXT,
      smtpPort INTEGER,
      smtpSecure BOOLEAN,
      emailUser TEXT,
      emailPassword TEXT,
      companyName TEXT,
      companyEmail TEXT,
      companyPhone TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Initialize SMTP settings if not exists
db.run(`
  INSERT OR IGNORE INTO smtpSettings (id, smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName)
  VALUES (1, ?, ?, ?, ?, ?, ?)
`, [
  process.env.SMTP_HOST || 'smtp.gmail.com',
  process.env.SMTP_PORT || 587,
  process.env.SMTP_SECURE === 'true' || false,
  process.env.EMAIL_USER || '',
  process.env.EMAIL_PASSWORD || '',
  process.env.COMPANY_NAME || 'Your Company'
]);

// Default email template
const defaultTemplate = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
<tr><td align="center" style="padding: 20px;">
<table width="600" style="background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" border="0" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 8px 8px 0 0;">
<h1 style="margin: 0; color: #fff; font-size: 26px;">Great News!</h1></td></tr>
<tr><td style="padding: 40px 30px;">
<p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello {{firstName}},</p>
<p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">A buyer has shown interest in your property:</p>
<p style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #333;">{{propertyAddress}}</p>
<p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Please join our Zoom meeting to discuss details.</p>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
<tr><td align="center">
<a href="{{zoomLink}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Meeting</a></td></tr></table>
<p style="margin: 0; font-size: 14px; color: #666;"><strong>Date:</strong> {{meetingDate}}<br><strong>Time:</strong> {{meetingTime}}</p></td></tr>
<tr><td style="padding: 0 30px 30px 30px;"><p style="margin: 0; font-size: 14px; color: #666;">{{companyName}} | {{companyPhone}}</p></td></tr></table></td></tr></table></body></html>`;

db.run(`
  INSERT OR IGNORE INTO emailTemplates (id, name, subject, htmlContent, isDefault)
  VALUES (1, 'Default Professional', 'Property Interest: {{propertyAddress}}', ?, 1)
`, [defaultTemplate]);

// ==================== FUNCTIONS ====================

function getSMTPSettings(callback) {
  db.get('SELECT * FROM smtpSettings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error('Error getting SMTP settings:', err);
      return callback(null);
    }
    callback(settings);
  });
}

function getTransporter(callback) {
  getSMTPSettings((settings) => {
    if (!settings || !settings.emailUser || !settings.smtpHost) {
      console.error('SMTP settings incomplete');
      return callback(null, null);
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      auth: {
        user: settings.emailUser,
        pass: settings.emailPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    callback(transporter, settings);
  });
}

// ==================== API ENDPOINTS ====================

// SMTP Settings
app.get('/api/smtp-settings', (req, res) => {
  getSMTPSettings((settings) => {
    if (!settings) {
      return res.json({
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false,
        emailUser: '',
        companyName: '',
        companyEmail: '',
        companyPhone: ''
      });
    }
    res.json({
      smtpHost: settings.smtpHost || '',
      smtpPort: settings.smtpPort || 587,
      smtpSecure: settings.smtpSecure || false,
      emailUser: settings.emailUser || '',
      companyName: settings.companyName || '',
      companyEmail: settings.companyEmail || '',
      companyPhone: settings.companyPhone || ''
    });
  });
});

app.post('/api/smtp-settings', (req, res) => {
  const { smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone } = req.body;

  if (!smtpHost || !emailUser || !emailPassword) {
    return res.status(400).json({ success: false, message: 'Missing SMTP credentials' });
  }

  db.run(
    `UPDATE smtpSettings SET 
     smtpHost = ?, smtpPort = ?, smtpSecure = ?, emailUser = ?, emailPassword = ?,
     companyName = ?, companyEmail = ?, companyPhone = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to save settings' });
      }

      // Test SMTP connection
      getTransporter((transporter, settings) => {
        if (transporter) {
          transporter.verify((error, success) => {
            if (error) {
              res.json({ success: false, message: 'SMTP test failed: ' + error.message });
            } else {
              res.json({ success: true, message: 'Settings saved and SMTP connection verified!' });
            }
          });
        } else {
          res.json({ success: false, message: 'Failed to create transporter' });
        }
      });
    }
  );
});

// Leads
app.post('/api/leads', (req, res) => {
  const { firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  db.run(
    `INSERT INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [firstName || '', lastName || '', email, phone || '', propertyAddress || '', propertyPrice || '', propertyType || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, error: 'Email already exists' });
        }
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      res.json({ success: true, id: this.lastID, message: 'Lead added' });
    }
  );
});

app.get('/api/leads', (req, res) => {
  db.all('SELECT * FROM leads ORDER BY createdAt DESC', (err, leads) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(leads || []);
  });
});

app.delete('/api/leads/:id', (req, res) => {
  db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Delete failed' });
    }
    res.json({ success: true, message: 'Lead deleted' });
  });
});

// FILE UPLOAD - This is the critical endpoint for CSV/Excel import
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      console.log('❌ No file received');
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No file uploaded' });
    }

    const fileName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;
    let rows = [];

    console.log('\n📁 UPLOAD START:', fileName);

    // Parse file
    if (fileName.endsWith('.csv')) {
      const csv = buffer.toString('utf-8');
      rows = parse(csv, { columns: true, skip_empty_lines: true });
      console.log('✅ CSV Parsed:', rows.length, 'rows');
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
      console.log('✅ Excel Parsed:', rows.length, 'rows');
    } else {
      console.log('❌ Invalid format:', fileName);
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'Invalid file format. Use CSV or Excel.' });
    }

    if (!rows || rows.length === 0) {
      console.log('❌ No rows found');
      return res.status(400).json({ success: false, inserted: 0, failed: 0, error: 'No data found in file' });
    }

    console.log('📊 Column headers:', Object.keys(rows[0]));

    // Auto-detect columns - IMPROVED for your format
    const detectColumn = (name) => {
      if (!name) return null;
      const n = name.toLowerCase().trim();
      
      // Exact matches first
      if (n === 'first name' || n === 'firstname' || n === 'first_name') return 'firstName';
      if (n === 'last name' || n === 'lastname' || n === 'last_name') return 'lastName';
      if (n === 'email' || n === 'email address') return 'email';
      if (n === 'phone' || n === 'phone number' || n === 'cell' || n === 'mobile') return 'phone';
      if (n === 'property address' || n === 'address' || n === 'property') return 'propertyAddress';
      if (n === 'property price' || n === 'price') return 'propertyPrice';
      if (n === 'property type' || n === 'type') return 'propertyType';
      
      // Fuzzy matches
      if (n.includes('first')) return 'firstName';
      if (n.includes('last')) return 'lastName';
      if (n.includes('email')) return 'email';
      if (n.includes('phone') || n.includes('cell') || n.includes('mobile')) return 'phone';
      if ((n.includes('property') || n.includes('address')) && n.includes('address')) return 'propertyAddress';
      if ((n.includes('property') || n.includes('price')) && n.includes('price')) return 'propertyPrice';
      if ((n.includes('property') || n.includes('type')) && n.includes('type')) return 'propertyType';
      
      return null;
    };

    const colMap = {};
    Object.keys(rows[0]).forEach(col => {
      const mapped = detectColumn(col);
      if (mapped) {
        colMap[col] = mapped;
        console.log(`  ✓ "${col}" → ${mapped}`);
      }
    });

    // Check if email column found
    const hasEmail = Object.values(colMap).includes('email');
    if (!hasEmail) {
      console.log('❌ Email column not found!');
      console.log('   Available columns:', Object.keys(rows[0]));
      return res.status(400).json({
        success: false,
        inserted: 0,
        failed: 0,
        error: 'Email column not found. Check your CSV headers: ' + Object.keys(rows[0]).join(', ')
      });
    }

    let inserted = 0, failed = 0, processed = 0;

    console.log('\n📝 Processing rows...');

    // Insert leads with proper callback tracking
    rows.forEach((row, idx) => {
      const lead = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        propertyAddress: '',
        propertyPrice: '',
        propertyType: ''
      };

      // Map values
      Object.keys(colMap).forEach(col => {
        const value = (row[col] || '').toString().trim();
        lead[colMap[col]] = value;
      });

      // Skip if no email
      if (!lead.email || lead.email === '') {
        console.log(`  Row ${idx + 1}: ❌ Missing email`);
        failed++;
        processed++;
        
        if (processed === rows.length) {
          finishUpload();
        }
        return;
      }

      console.log(`  Row ${idx + 1}: ${lead.firstName || '?'} ${lead.lastName || '?'} <${lead.email}>`);

      // Insert with OR IGNORE for duplicates
      db.run(
        `INSERT OR IGNORE INTO leads 
         (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.phone,
          lead.propertyAddress,
          lead.propertyPrice,
          lead.propertyType
        ],
        function(err) {
          if (err) {
            console.log(`    ❌ Database error: ${err.message}`);
            failed++;
          } else if (this.changes > 0) {
            console.log(`    ✅ Inserted`);
            inserted++;
          } else {
            console.log(`    ⊘ Duplicate (skipped)`);
            failed++;
          }

          processed++;

          // When all rows processed, send response
          if (processed === rows.length) {
            finishUpload();
          }
        }
      );
    });

    function finishUpload() {
      console.log(`\n✅ UPLOAD COMPLETE: ${inserted} inserted, ${failed} failed`);
      res.json({
        success: true,
        inserted,
        failed,
        total: rows.length,
        message: `✓ Upload complete! ${inserted} added.`
      });
    }

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({
      success: false,
      inserted: 0,
      failed: 0,
      error: 'Error: ' + error.message
    });
  }
});

// Templates
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM emailTemplates ORDER BY createdAt DESC', (err, templates) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(templates || []);
  });
});

app.get('/api/templates/:id', (req, res) => {
  db.get('SELECT * FROM emailTemplates WHERE id = ?', [req.params.id], (err, template) => {
    if (err || !template) return res.status(404).json({ error: 'Not found' });
    res.json(template);
  });
});

app.post('/api/templates', (req, res) => {
  const { id, name, subject, htmlContent } = req.body;

  if (!name || !subject || !htmlContent) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  if (id) {
    // Update
    db.run(
      `UPDATE emailTemplates SET name = ?, subject = ?, htmlContent = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, subject, htmlContent, id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: 'Update failed' });
        res.json({ success: true, id, message: 'Template updated' });
      }
    );
  } else {
    // Create
    db.run(
      `INSERT INTO emailTemplates (name, subject, htmlContent) VALUES (?, ?, ?)`,
      [name, subject, htmlContent],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: 'Create failed' });
        res.json({ success: true, id: this.lastID, message: 'Template created' });
      }
    );
  }
});

app.delete('/api/templates/:id', (req, res) => {
  db.run('DELETE FROM emailTemplates WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ success: true, message: 'Template deleted' });
  });
});

// Campaigns
app.post('/api/campaigns', (req, res) => {
  const { leadIds, campaignName, templateId, zoomLink, meetingDate, meetingTime } = req.body;

  if (!Array.isArray(leadIds) || !templateId) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  db.get('SELECT * FROM emailTemplates WHERE id = ?', [templateId], (err, template) => {
    if (err || !template) return res.status(404).json({ error: 'Template not found' });

    getTransporter((transporter, settings) => {
      if (!transporter) return res.status(500).json({ error: 'SMTP not configured' });

      let success = 0, failed = 0;

      const sendNext = (idx) => {
        if (idx >= leadIds.length) {
          res.json({ success: true, sent: success, failed, message: `Campaign sent: ${success} success, ${failed} failed` });
          return;
        }

        db.get('SELECT * FROM leads WHERE id = ?', [leadIds[idx]], (err, lead) => {
          if (err || !lead) {
            failed++;
            sendNext(idx + 1);
            return;
          }

          let subject = template.subject;
          let html = template.htmlContent;

          const vars = {
            firstName: lead.firstName || 'Valued Customer',
            lastName: lead.lastName || '',
            email: lead.email,
            phone: lead.phone || '',
            propertyAddress: lead.propertyAddress || '',
            propertyPrice: lead.propertyPrice || '',
            propertyType: lead.propertyType || '',
            zoomLink: zoomLink || '#',
            meetingDate: meetingDate || '',
            meetingTime: meetingTime || '',
            companyName: settings.companyName || '',
            companyEmail: settings.companyEmail || '',
            companyPhone: settings.companyPhone || ''
          };

          Object.keys(vars).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, vars[key]);
            html = html.replace(regex, vars[key]);
          });

          transporter.sendMail(
            {
              from: `"${settings.companyName}" <${settings.emailUser}>`,
              to: lead.email,
              subject,
              html
            },
            (error) => {
              if (!error) {
                success++;
                db.run(
                  `INSERT INTO campaigns (leadId, campaignName, emailSent, sentAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
                  [lead.id, campaignName || 'Campaign']
                );
              } else {
                failed++;
              }
              sendNext(idx + 1);
            }
          );
        });
      };

      sendNext(0);
    });
  });
});

app.get('/api/campaigns', (req, res) => {
  db.all(
    `SELECT c.*, l.firstName, l.lastName, l.email FROM campaigns c
     JOIN leads l ON c.leadId = l.id ORDER BY c.createdAt DESC LIMIT 100`,
    (err, campaigns) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(campaigns || []);
    }
  );
});

app.get('/api/campaigns/stats', (req, res) => {
  db.get(
    `SELECT COUNT(*) as total, SUM(CASE WHEN emailSent = 1 THEN 1 ELSE 0 END) as emailsSent,
     SUM(CASE WHEN opened = 1 THEN 1 ELSE 0 END) as emailsOpened,
     SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as emailsClicked FROM campaigns`,
    (err, stats) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(stats || { total: 0, emailsSent: 0, emailsOpened: 0, emailsClicked: 0 });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Email Campaign Manager running on port ${PORT}`);
  console.log('📧 API ready at http://localhost:' + PORT + '/api');
  console.log('🌐 Dashboard at http://localhost:' + PORT);
  console.log('\n✅ All endpoints operational');
});
