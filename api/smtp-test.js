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
        if (!req.body.host) return res.status(400).json({ success: false, error: 'SMTP host required' });
        const transporter = buildTransport(req.body);
        await transporter.verify();
        res.json({ success: true, message: 'SMTP connection successful! Server is reachable.' });
    } catch (err) {
        res.json({ success: false, error: err.message || 'Connection failed' });
    }
};
