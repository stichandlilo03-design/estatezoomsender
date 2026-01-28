const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('public'));

// IN-MEMORY DATA STORES
let leads = [];
let templates = [
  { id: 1, name: 'Default Property', subject: 'Great News About {{propertyAddress}}', html: '<h1>Hello {{firstName}}!</h1><p>Property: {{propertyAddress}}</p><p>Price: {{propertyPrice}}</p><p><a href="{{zoomLink}}">Join Zoom</a></p>' }
];
let campaigns = [];
let sendingLogs = [];
let smtpSettings = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  company: '',
  email: '',
  phone: ''
};

let nextLeadId = 1;
let nextTemplateId = 2;
let nextCampaignId = 1;

const upload = multer({ storage: multer.memoryStorage() });

// ==================== LEADS ====================

app.get('/api/leads', (req, res) => {
  res.json(leads);
});

app.post('/api/leads', (req, res) => {
  try {
    const { firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType } = req.body;
    
    if (!email) return res.json({ success: false, error: 'Email required' });
    if (leads.some(l => l.email === email)) return res.json({ success: false, error: 'Email exists' });

    leads.push({
      id: nextLeadId++,
      firstName: firstName || '',
      lastName: lastName || '',
      email,
      phone: phone || '',
      propertyAddress: propertyAddress || '',
      propertyPrice: propertyPrice || '',
      propertyType: propertyType || '',
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/leads/:id', (req, res) => {
  leads = leads.filter(l => l.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// ==================== CLEAR ALL ====================

app.post('/api/clear-all', (req, res) => {
  try {
    leads = [];
    templates = [
      { id: 1, name: 'Default Property', subject: 'Great News About {{propertyAddress}}', html: '<h1>Hello {{firstName}}!</h1><p>Property: {{propertyAddress}}</p>' }
    ];
    campaigns = [];
    sendingLogs = [];
    nextLeadId = 1;
    nextTemplateId = 2;
    nextCampaignId = 1;
    
    res.json({ success: true, message: 'All data cleared' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ==================== UPLOAD ====================

app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, inserted: 0, failed: 0 });

    const fileName = req.file.originalname.toLowerCase();
    let rows = [];

    if (fileName.endsWith('.csv')) {
      rows = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    if (!rows || rows.length === 0) return res.json({ success: false, inserted: 0, failed: 0 });

    const mapCol = (name) => {
      const n = (name || '').toLowerCase().trim();
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
    const headers = Object.keys(rows[0] || {});
    headers.forEach(col => {
      const m = mapCol(col);
      if (m) colMap[col] = m;
    });

    if (!Object.values(colMap).includes('email')) {
      return res.json({ success: false, inserted: 0, failed: 0 });
    }

    let inserted = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const lead = {};
        Object.keys(colMap).forEach(col => {
          lead[colMap[col]] = (row[col] || '').toString().trim();
        });

        if (!lead.email || leads.some(l => l.email === lead.email)) {
          failed++;
          continue;
        }

        leads.push({
          id: nextLeadId++,
          firstName: lead.firstName || '',
          lastName: lead.lastName || '',
          email: lead.email,
          phone: lead.phone || '',
          propertyAddress: lead.propertyAddress || '',
          propertyPrice: lead.propertyPrice || '',
          propertyType: lead.propertyType || '',
          createdAt: new Date().toISOString()
        });

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

app.get('/api/templates', (req, res) => {
  res.json(templates);
});

app.get('/api/templates/:id', (req, res) => {
  const t = templates.find(x => x.id === parseInt(req.params.id));
  res.json(t || {});
});

app.post('/api/templates', (req, res) => {
  try {
    const { id, name, subject, html } = req.body;
    if (!name || !subject || !html) return res.json({ success: false });

    if (id) {
      const idx = templates.findIndex(t => t.id === id);
      if (idx >= 0) templates[idx] = { id, name, subject, html };
    } else {
      templates.push({ id: nextTemplateId++, name, subject, html });
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// ==================== SMTP ====================

app.get('/api/smtp-settings', (req, res) => {
  res.json(smtpSettings);
});

app.post('/api/smtp-settings', (req, res) => {
  try {
    const { host, port, secure, user, pass, company, email, phone } = req.body;
    
    smtpSettings = {
      host: host || 'smtp.gmail.com',
      port: port || 587,
      secure: secure === 'true' || secure === true,
      user: user || '',
      pass: pass || '',
      company: company || '',
      email: email || '',
      phone: phone || ''
    };

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// ==================== SMTP TEST ====================

app.post('/api/smtp-test', async (req, res) => {
  try {
    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass) {
      return res.json({ success: false, error: 'Settings incomplete' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: { user: smtpSettings.user, pass: smtpSettings.pass }
    });

    const verified = await transporter.verify();
    if (verified) {
      res.json({ success: true, message: 'Connection successful!' });
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
    if (!smtpSettings.user || !smtpSettings.pass) return res.json({ success: false, error: 'SMTP not configured' });

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: { user: smtpSettings.user, pass: smtpSettings.pass }
    });

    await transporter.sendMail({
      from: smtpSettings.user,
      to: email,
      subject: 'Test Email - Campaign Manager',
      html: '<h1>✓ Success!</h1><p>Your SMTP is working correctly!</p>'
    });

    res.json({ success: true, message: 'Email sent to ' + email });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ==================== CAMPAIGNS & SENDING LOGS ====================

app.get('/api/campaigns', (req, res) => {
  res.json(campaigns);
});

app.get('/api/campaigns/logs', (req, res) => {
  res.json(sendingLogs);
});

app.post('/api/campaigns/send', async (req, res) => {
  try {
    const { templateId, zoomLink, meetingDate, meetingTime } = req.body;

    const template = templates.find(t => t.id === parseInt(templateId));
    if (!template) return res.json({ success: false, error: 'Template not found' });
    if (leads.length === 0) return res.json({ success: false, error: 'No leads' });
    if (!smtpSettings.user || !smtpSettings.pass) return res.json({ success: false, error: 'SMTP not configured' });

    const campaignId = nextCampaignId++;
    const campaign = {
      id: campaignId,
      name: 'Campaign ' + campaignId,
      templateId,
      leadsCount: leads.length,
      sentAt: new Date().toISOString(),
      status: 'sending'
    };
    campaigns.push(campaign);

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: { user: smtpSettings.user, pass: smtpSettings.pass }
    });

    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        let html = template.html;
        html = html.replace(/{{firstName}}/g, lead.firstName || '');
        html = html.replace(/{{lastName}}/g, lead.lastName || '');
        html = html.replace(/{{email}}/g, lead.email || '');
        html = html.replace(/{{phone}}/g, lead.phone || '');
        html = html.replace(/{{propertyAddress}}/g, lead.propertyAddress || '');
        html = html.replace(/{{propertyPrice}}/g, lead.propertyPrice || '');
        html = html.replace(/{{propertyType}}/g, lead.propertyType || '');
        html = html.replace(/{{zoomLink}}/g, zoomLink || '');
        html = html.replace(/{{meetingDate}}/g, meetingDate || '');
        html = html.replace(/{{meetingTime}}/g, meetingTime || '');
        html = html.replace(/{{companyName}}/g, smtpSettings.company || '');

        let subject = template.subject;
        subject = subject.replace(/{{firstName}}/g, lead.firstName || '');
        subject = subject.replace(/{{propertyAddress}}/g, lead.propertyAddress || '');

        await transporter.sendMail({
          from: smtpSettings.user,
          to: lead.email,
          subject: subject,
          html: html
        });

        sent++;

        sendingLogs.push({
          campaignId,
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.firstName + ' ' + lead.lastName,
          status: 'success',
          message: 'Sent successfully',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        failed++;

        sendingLogs.push({
          campaignId,
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.firstName + ' ' + lead.lastName,
          status: 'failed',
          message: e.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    campaign.status = 'completed';
    campaign.sent = sent;
    campaign.failed = failed;

    res.json({ success: true, sent, failed, total: leads.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Export
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
}
