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
        const { host, testEmail, user, senderName, fromEmail } = req.body;
        if (!host) return res.status(400).json({ success: false, error: 'SMTP host required' });
        if (!testEmail) return res.status(400).json({ success: false, error: 'Test email required' });

        const transporter = buildTransport(req.body);
        const from = fromEmail || user || ('noreply@' + host);
        const name = senderName || 'Dual Sender';

        await transporter.sendMail({
            from: '"' + name + '" <' + from + '>',
            to: testEmail,
            subject: 'Dual Sender — SMTP Test Successful',
            html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px"><h2 style="color:#667eea">SMTP Test Successful</h2><p>Your email settings are working correctly.</p><p><strong>Host:</strong> ' + host + '<br><strong>From:</strong> ' + name + ' &lt;' + from + '&gt;</p><p style="color:#666;margin-top:20px">Sent from Dual Sender Dashboard</p></div>'
        });
        res.json({ success: true, message: 'Test email sent to ' + testEmail + '! Check inbox.' });
    } catch (err) {
        res.json({ success: false, error: err.message || 'Send failed' });
    }
};
