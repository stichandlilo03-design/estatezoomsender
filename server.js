const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const XLSX = require('xlsx');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for file uploads
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
const db = new sqlite3.Database('./campaigns.db', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Create tables if they don't exist
db.serialize(() => {
  // Leads table with dynamic fields
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

  // Email logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS emailLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaignId INTEGER NOT NULL,
      status TEXT,
      messageId TEXT,
      error TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campaignId) REFERENCES campaigns(id)
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

// Initialize default template and settings
db.run(`
  INSERT OR IGNORE INTO smtpSettings (id, smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
  process.env.SMTP_HOST || 'smtp.gmail.com',
  process.env.SMTP_PORT || 587,
  process.env.SMTP_SECURE === 'true',
  process.env.EMAIL_USER || '',
  process.env.EMAIL_PASSWORD || '',
  process.env.COMPANY_NAME || 'Your Company',
  process.env.COMPANY_EMAIL || '',
  process.env.COMPANY_PHONE || ''
]);

// Create default template
const defaultTemplate = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email</title></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
<tr><td align="center" style="padding: 20px;">
<table width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" border="0" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; border-radius: 8px 8px 0 0;">
<h1 style="margin: 0; color: #ffffff; font-size: 26px;">Great News About Your Property!</h1></td></tr>
<tr><td style="padding: 40px 30px;">
<p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hello {{firstName}},</p>
<p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">We have exciting news! A serious buyer has expressed strong interest in your property and would like to schedule a virtual meeting with you.</p>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 25px 0; background-color: #F0FDF4; border-left: 4px solid #10B981; border-radius: 4px;">
<tr><td style="padding: 20px;">
<p style="margin: 0 0 8px 0; font-size: 12px; color: #065F46; font-weight: bold; text-transform: uppercase;">📍 PROPERTY ADDRESS</p>
<p style="margin: 0; font-size: 18px; color: #1A1D29; font-weight: bold;">{{propertyAddress}}</p></td></tr></table>
<p style="margin: 0 0 15px 0; font-size: 16px; color: #333333;">The buyer would like to connect with you via Zoom to discuss details about the home.</p>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
<tr><td align="center">
<a href="{{zoomLink}}" style="display: inline-block; padding: 16px 40px; background-color: #10B981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">🎥 Join Zoom Meeting</a></td></tr></table>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
<tr><td style="padding: 20px;">
<h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400E; font-weight: bold;">📅 Meeting Details</h3>
<p style="margin: 0 0 8px 0; font-size: 15px; color: #1A1D29;"><strong>Date:</strong> {{meetingDate}}</p>
<p style="margin: 0; font-size: 15px; color: #1A1D29;"><strong>Time:</strong> {{meetingTime}} EST</p></td></tr></table>
<p style="margin: 0; font-size: 16px; color: #333333;">If you have any questions, please don't hesitate to reach out. We're here to help!</p></td></tr>
<tr><td style="padding: 0 30px 30px 30px; border-top: 2px solid #E5E7EB;">
<p style="margin: 20px 0 10px 0; font-size: 16px; color: #333333; font-weight: 600;">Looking forward to connecting,</p>
<p style="margin: 0; font-size: 16px; color: #1A1D29; font-weight: bold;">{{companyName}}</p>
<p style="margin: 0; font-size: 14px; color: #666666;">{{companyPhone}}</p></td></tr>
<tr><td align="center" style="padding: 20px 30px; background-color: #FAFBFC; border-radius: 0 0 8px 8px;">
<p style="margin: 0; font-size: 12px; color: #999999;">© 2026 {{companyName}}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

db.run(`
  INSERT OR IGNORE INTO emailTemplates (id, name, subject, htmlContent, isDefault)
  VALUES (1, 'Default Professional', 'Exclusive Meeting Opportunity - {{propertyAddress}}', ?, 1)
`, [defaultTemplate]);

// Get current SMTP settings
function getSMTPSettings(callback) {
  db.get('SELECT * FROM smtpSettings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error('Error getting SMTP settings:', err);
      return callback(null);
    }
    callback(settings);
  });
}

// Create transporter dynamically from settings
function getTransporter(callback) {
  getSMTPSettings((settings) => {
    if (!settings || !settings.emailUser) {
      console.error('SMTP settings not configured');
      return callback(null);
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.emailUser,
        pass: settings.emailPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP verification error:', error.message);
      } else {
        console.log('SMTP connection verified ✓');
      }
    });

    callback(transporter, settings);
  });
}

// API: Get SMTP Settings
app.get('/api/smtp-settings', (req, res) => {
  getSMTPSettings((settings) => {
    if (!settings) {
      return res.status(500).json({ error: 'No SMTP settings found' });
    }
    // Don't send password to frontend
    res.json({
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      emailUser: settings.emailUser,
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone
    });
  });
});

// API: Update SMTP Settings
app.post('/api/smtp-settings', (req, res) => {
  const { smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone } = req.body;

  db.run(`
    UPDATE smtpSettings 
    SET smtpHost = ?, smtpPort = ?, smtpSecure = ?, emailUser = ?, emailPassword = ?, 
        companyName = ?, companyEmail = ?, companyPhone = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [smtpHost, smtpPort, smtpSecure, emailUser, emailPassword, companyName, companyEmail, companyPhone], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update SMTP settings', details: err.message });
    }

    // Verify new settings
    getTransporter((transporter) => {
      if (transporter) {
        res.json({ success: true, message: 'SMTP settings updated and verified ✓' });
      } else {
        res.status(500).json({ error: 'SMTP settings updated but verification failed. Check credentials.' });
      }
    });
  });
});

// API: Get Email Templates
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM emailTemplates ORDER BY createdAt DESC', (err, templates) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(templates);
  });
});

// API: Get Single Template
app.get('/api/templates/:id', (req, res) => {
  db.get('SELECT * FROM emailTemplates WHERE id = ?', [req.params.id], (err, template) => {
    if (err || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });
});

// API: Create/Update Template
app.post('/api/templates', (req, res) => {
  const { id, name, subject, htmlContent } = req.body;

  if (!name || !subject || !htmlContent) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (id) {
    // Update existing
    db.run(`
      UPDATE emailTemplates 
      SET name = ?, subject = ?, htmlContent = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, subject, htmlContent, id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update template' });
      }
      res.json({ success: true, id: id, message: 'Template updated' });
    });
  } else {
    // Create new
    db.run(`
      INSERT INTO emailTemplates (name, subject, htmlContent)
      VALUES (?, ?, ?)
    `, [name, subject, htmlContent], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create template' });
      }
      res.json({ success: true, id: this.lastID, message: 'Template created' });
    });
  }
});

// API: Delete Template
app.delete('/api/templates/:id', (req, res) => {
  if (req.params.id === '1') {
    return res.status(400).json({ error: 'Cannot delete default template' });
  }

  db.run('DELETE FROM emailTemplates WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete template' });
    }
    res.json({ success: true, message: 'Template deleted' });
  });
});

// API: Add Lead
app.post('/api/leads', (req, res) => {
  const { firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, customData } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  db.run(
    `INSERT INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, customData) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [firstName || '', lastName || '', email, phone || '', propertyAddress || '', propertyPrice || '', propertyType || '', customData || ''],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Lead already exists or database error' });
      }
      res.json({ success: true, leadId: this.lastID });
    }
  );
});

// API: Upload Leads (CSV/Excel)
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileName = req.file.originalname.toLowerCase();
  let leadsList = [];

  try {
    if (fileName.endsWith('.csv')) {
      // Parse CSV
      const csvText = req.file.buffer.toString('utf-8');
      const records = [];
      
      parse(csvText, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) {
          return res.status(400).json({ error: 'Invalid CSV format' });
        }

        insertLeads(records, res);
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse Excel
      const workbook = XLSX.read(req.file.buffer);
      const sheetName = workbook.SheetNames[0];
      const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      insertLeads(records, res);
    } else {
      res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process file', details: error.message });
  }
});

function insertLeads(records, res) {
  let inserted = 0;
  let failed = 0;
  let errors = [];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO leads (firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, customData)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  records.forEach((record, index) => {
    // Map common field variations
    const firstName = record['First Name'] || record['firstName'] || record['first_name'] || '';
    const lastName = record['Last Name'] || record['lastName'] || record['last_name'] || '';
    const email = record['Email'] || record['email'] || record['Email Address'] || '';
    const phone = record['Phone'] || record['phone'] || record['Phone Number'] || '';
    const propertyAddress = record['Property Address'] || record['propertyAddress'] || record['property_address'] || record['Address'] || '';
    const propertyPrice = record['Property Price'] || record['propertyPrice'] || record['property_price'] || record['Price'] || '';
    const propertyType = record['Property Type'] || record['propertyType'] || record['property_type'] || record['Type'] || '';
    const customData = JSON.stringify(record); // Store all extra fields

    if (!email) {
      failed++;
      errors.push(`Row ${index + 1}: Missing email`);
      return;
    }

    stmt.run([firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType, customData], function(err) {
      if (err) {
        failed++;
        errors.push(`Row ${index + 1}: ${email} - Already exists or invalid`);
      } else {
        inserted++;
      }
    });
  });

  stmt.finalize((err) => {
    res.json({
      success: true,
      inserted,
      failed,
      total: records.length,
      errors: errors.slice(0, 10) // Show first 10 errors
    });
  });
}

// API: Get All Leads
app.get('/api/leads', (req, res) => {
  db.all('SELECT * FROM leads ORDER BY createdAt DESC', (err, leads) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(leads);
  });
});

// API: Get Single Lead
app.get('/api/leads/:id', (req, res) => {
  db.get('SELECT * FROM leads WHERE id = ?', [req.params.id], (err, lead) => {
    if (err || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  });
});

// API: Delete Lead
app.delete('/api/leads/:id', (req, res) => {
  db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete lead' });
    }
    res.json({ success: true, message: 'Lead deleted' });
  });
});

// API: Send Campaign
app.post('/api/campaigns/send', async (req, res) => {
  const { leadId, campaignName, templateId, zoomLink, meetingDate, meetingTime } = req.body;

  if (!leadId || !templateId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    db.get('SELECT * FROM leads WHERE id = ?', [leadId], (err, lead) => {
      if (err || !lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      db.get('SELECT * FROM emailTemplates WHERE id = ?', [templateId], (err, template) => {
        if (err || !template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        getTransporter((transporter, settings) => {
          if (!transporter) {
            return res.status(500).json({ error: 'Email service not configured properly' });
          }

          // Replace template variables
          let subject = template.subject;
          let htmlContent = template.htmlContent;

          const variables = {
            firstName: lead.firstName || 'Valued Client',
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

          // Replace all variables
          Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, variables[key]);
            htmlContent = htmlContent.replace(regex, variables[key]);
          });

          const mailOptions = {
            from: `"${settings.companyName}" <${settings.emailUser}>`,
            to: lead.email,
            subject: subject,
            html: htmlContent
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              res.status(500).json({ error: 'Failed to send email', details: error.message });
              
              // Log error
              db.run(
                `INSERT INTO emailLogs (campaignId, status, error) 
                 VALUES ((SELECT MAX(id) FROM campaigns WHERE leadId = ?), 'failed', ?)`,
                [leadId, error.message]
              );
            } else {
              // Create campaign record
              db.run(
                `INSERT INTO campaigns (leadId, campaignName, emailSent, sentAt) 
                 VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
                [leadId, campaignName || 'Manual Send'],
                function(err) {
                  if (!err) {
                    db.run(
                      `INSERT INTO emailLogs (campaignId, status, messageId) 
                       VALUES (?, 'sent', ?)`,
                      [this.lastID, info.messageId]
                    );
                  }
                }
              );

              res.json({ success: true, message: `Email sent to ${lead.email}`, messageId: info.messageId });
            }
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// API: Bulk Send Campaign
app.post('/api/campaigns/bulk-send', async (req, res) => {
  const { leadIds, campaignName, templateId, zoomLink, meetingDate, meetingTime } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0 || !templateId) {
    return res.status(400).json({ error: 'No leads or template provided' });
  }

  const results = { success: 0, failed: 0, errors: [] };

  getTransporter((transporter, settings) => {
    if (!transporter) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    db.get('SELECT * FROM emailTemplates WHERE id = ?', [templateId], (err, template) => {
      if (err || !template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const sendNext = (index) => {
        if (index >= leadIds.length) {
          res.json({ ...results, message: `Campaign complete: ${results.success} sent, ${results.failed} failed` });
          return;
        }

        const leadId = leadIds[index];
        db.get('SELECT * FROM leads WHERE id = ?', [leadId], (err, lead) => {
          if (err || !lead) {
            results.failed++;
            results.errors.push(`Lead ${leadId} not found`);
            sendNext(index + 1);
            return;
          }

          let subject = template.subject;
          let htmlContent = template.htmlContent;

          const variables = {
            firstName: lead.firstName || 'Valued Client',
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

          Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, variables[key]);
            htmlContent = htmlContent.replace(regex, variables[key]);
          });

          const mailOptions = {
            from: `"${settings.companyName}" <${settings.emailUser}>`,
            to: lead.email,
            subject: subject,
            html: htmlContent
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              results.failed++;
              results.errors.push(`${lead.email}: ${error.message}`);
            } else {
              results.success++;
              db.run(
                `INSERT INTO campaigns (leadId, campaignName, emailSent, sentAt) 
                 VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
                [leadId, campaignName || 'Bulk Campaign'],
                function(err) {
                  if (!err) {
                    db.run(
                      `INSERT INTO emailLogs (campaignId, status, messageId) 
                       VALUES (?, 'sent', ?)`,
                      [this.lastID, info.messageId]
                    );
                  }
                }
              );
            }

            sendNext(index + 1);
          });
        });
      };

      sendNext(0);
    });
  });
});

// API: Get Campaign Statistics
app.get('/api/campaigns/stats', (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as totalCampaigns,
      SUM(CASE WHEN emailSent = 1 THEN 1 ELSE 0 END) as emailsSent,
      SUM(CASE WHEN opened = 1 THEN 1 ELSE 0 END) as emailsOpened,
      SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as emailsClicked
    FROM campaigns`,
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(stats);
    }
  );
});

// API: Get Campaign History
app.get('/api/campaigns', (req, res) => {
  db.all(
    `SELECT c.*, l.firstName, l.lastName, l.email, l.propertyAddress 
     FROM campaigns c 
     JOIN leads l ON c.leadId = l.id 
     ORDER BY c.createdAt DESC LIMIT 100`,
    (err, campaigns) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(campaigns);
    }
  );
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Email automation server running on http://localhost:${PORT}`);
  console.log('📧 Ready to send personalized campaigns!');
  console.log('⚙️  Configure SMTP & templates in the dashboard');
});
