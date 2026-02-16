const nodemailer = require('nodemailer');

function buildTransport(cfg) {
    const port = parseInt(cfg.port) || 587;
    const secure = port === 465;
    const transportConfig = {
        host: cfg.host, port, secure,
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
        tls: { rejectUnauthorized: false }
    };
    if (cfg.user && cfg.pass) transportConfig.auth = { user: cfg.user, pass: cfg.pass };
    return nodemailer.createTransport(transportConfig);
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { smtp, to, subject, html } = req.body;
        if (!smtp || !smtp.host) return res.status(400).json({ success: false, error: 'SMTP config missing' });
        if (!to) return res.status(400).json({ success: false, error: 'Recipient required' });

        const transporter = buildTransport(smtp);
        const fromEmail = smtp.fromEmail || smtp.user || ('noreply@' + smtp.host);
        const fromName = smtp.senderName || smtp.companyName || 'Dual Sender';

        await transporter.sendMail({
            from: '"' + fromName + '" <' + fromEmail + '>',
            to, subject: subject || '(No subject)', html: html || ''
        });
        res.json({ success: true, message: 'Delivered' });
    } catch (err) {
        res.json({ success: false, error: err.message || 'Send failed' });
    }
};
