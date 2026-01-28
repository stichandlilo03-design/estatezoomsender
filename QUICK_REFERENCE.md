# 📋 Email Campaign Manager Pro v2.0 - Quick Reference Card

## 🚀 Getting Started (5 Minutes)

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📊 Dashboard Tabs Overview

### 📊 Dashboard
- Real-time statistics
- Emails sent, opens, clicks
- Total leads count
- Recent campaigns (last 10)

### 👥 Leads & Import
- **Add Single Lead**: Manual form entry
- **Bulk Upload**: CSV or Excel files
- **Leads Table**: View, edit, delete all leads
- Shows: Name, Email, Phone, Property, Price, Type

### 📝 Email Templates
- **Create Templates**: Multiple templates supported
- **Edit Templates**: Drag-and-drop HTML
- **Variables**: 12+ personalization options
- **Default**: Professional template included

### 🚀 Send Campaigns
- **Campaign Name**: Track by name
- **Select Template**: Choose from your templates
- **Meeting Details**: Zoom link, date, time
- **Lead Selection**: Send to one or all
- **Auto-Personalization**: Variables auto-fill

### ⚙️ SMTP Settings
- **Email Configuration**: Host, port, security
- **Credentials**: Email and app password
- **Company Info**: Name, email, phone
- **Verify**: Auto-test connection

---

## 🔄 Template Variables

```
{{firstName}}        Lead's first name
{{lastName}}         Lead's last name
{{email}}           Lead's email
{{phone}}           Lead's phone

{{propertyAddress}} Their property address
{{propertyPrice}}   Property price
{{propertyType}}    Property type (house, condo, etc)

{{zoomLink}}        Your Zoom meeting link
{{meetingDate}}     Meeting date
{{meetingTime}}     Meeting time

{{companyName}}     Your company name
{{companyPhone}}    Your phone number
```

---

## 📤 CSV/Excel Format

### Minimum Required:
- Email column (only required field)

### Recommended Columns:
```
First Name, Last Name, Email, Phone, Property Address, Property Price, Property Type
```

### Auto-Detection:
✅ firstName, first_name, First Name (all work!)
✅ propertyAddress, property_address, Property Address (all work!)
✅ System is flexible with column names

---

## 🎯 Sending Campaign (Step-by-Step)

1. Click **"🚀 Send Campaigns"**
2. Enter **Campaign Name** (optional)
3. **Select Template** (required)
4. Enter **Zoom Link** (optional but recommended)
5. Enter **Meeting Date** (e.g., "Friday, February 14th, 2026")
6. Enter **Meeting Time** (e.g., "3:00 PM")
7. **Select Leads**: Choose individual OR "Send to ALL"
8. Click **"🎯 Send Campaign"**
9. Emails send immediately
10. Check stats in Dashboard

---

## 📝 Creating Email Template (Step-by-Step)

1. Click **"📝 Email Templates"**
2. Click **"+ Create New Template"**
3. Enter **Template Name**: (e.g., "Spring 2026 Campaign")
4. Enter **Email Subject**: (e.g., "Exclusive Meeting - {{propertyAddress}}")
5. Enter **HTML Content**: Paste your email HTML
6. Use variables in HTML: {{firstName}}, {{propertyAddress}}, etc
7. Click **"💾 Save Template"**
8. Template saved and ready to use!

### Example Subject:
```
Exclusive Meeting Opportunity - {{propertyAddress}}
```

### Example HTML Snippet:
```html
<p>Hello {{firstName}},</p>
<p>We have a buyer interested in {{propertyAddress}}</p>
<a href="{{zoomLink}}">Join Meeting</a>
<p>Date: {{meetingDate}} at {{meetingTime}}</p>
```

---

## 📤 Uploading Leads from CSV (Step-by-Step)

1. Click **"👥 Leads & Import"**
2. Prepare CSV file with columns:
   ```
   First Name,Last Name,Email,Phone,Property Address
   ```
3. Click **"📤 Bulk Import Leads"**
4. Click or drag CSV file
5. System auto-maps fields
6. Shows: X inserted, Y failed
7. Leads appear in table immediately

---

## ⚙️ Configure SMTP (Step-by-Step)

### For Gmail:

1. Get App Password:
   - Go to myaccount.google.com
   - Click Security
   - Search "App passwords"
   - Select Mail → Windows Computer
   - Copy 16-character password

2. In Dashboard:
   - Click **"⚙️ SMTP Settings"**
   - Enter:
     ```
     SMTP Host: smtp.gmail.com
     SMTP Port: 587
     Secure: OFF (unchecked)
     Email: your-email@gmail.com
     Password: your-16-char-password
     Company Name: Your Company
     ```
   - Click **"✅ Save & Verify"**
   - Shows "Email service ready" ✓

### For Other Providers:
Check their SMTP settings page for:
- SMTP Host
- SMTP Port
- Username/Password

---

## 🌐 Deploying to Vercel

1. Push code to GitHub
2. Go to vercel.com
3. Click "New Project"
4. Import your GitHub repo
5. Add Environment Variables:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   COMPANY_NAME=Your Company
   ```
6. Click Deploy
7. Wait 1-2 minutes
8. Your system is live! 🎉

**See VERCEL_DEPLOYMENT.md for detailed guide**

---

## 🔍 Field Mapping Reference

| Standard Name | Will Match |
|---|---|
| First Name | firstName, first_name, FirstName |
| Last Name | lastName, last_name, LastName |
| Email | email, Email, EMAIL, Email Address |
| Phone | phone, Phone, phone_number |
| Property Address | property_address, propertyAddress, address |
| Property Price | property_price, propertyPrice, price |
| Property Type | property_type, propertyType, type |

---

## 💡 Pro Tips

1. **Test First**: Send to yourself before bulk
2. **Use Variables**: Always use {{firstName}}, {{propertyAddress}} etc
3. **Professional Templates**: HTML can be basic or fancy
4. **Zoom Links**: Use personal meeting ID for consistency
5. **Backup Data**: Export leads regularly
6. **Monitor Stats**: Check Dashboard after sending
7. **Organize Leads**: Delete duplicates before bulk upload
8. **Template Testing**: Create test template with sample data

---

## ⚠️ Common Mistakes to Avoid

❌ **Wrong**: {{first_name}} (with underscore)
✅ **Right**: {{firstName}} (camelCase)

❌ **Wrong**: Upload file without Email column
✅ **Right**: Include Email column (required)

❌ **Wrong**: Using regular Gmail password
✅ **Right**: Use App Password (16 characters)

❌ **Wrong**: Port 25 (usually blocked)
✅ **Right**: Port 587 or 465

❌ **Wrong**: Forgetting to save template
✅ **Right**: Click "💾 Save Template"

---

## 🆘 Troubleshooting

**Q: Email not sending?**
A: Check Settings tab, verify SMTP works, click Save & Verify

**Q: CSV won't upload?**
A: Ensure Email column exists, file is UTF-8, use CSV not XLSX

**Q: Variables showing as {{variable}}?**
A: Check exact variable name in template, no spaces or typos

**Q: Dashboard slow?**
A: Normal for 10k+ leads, consider database upgrade later

**Q: Can't access localhost:3000?**
A: Check server is running (`npm run dev`), port not blocked

---

## 📊 Database Schema Quick Look

```
leads: firstName, lastName, email, phone, propertyAddress, propertyPrice, propertyType
campaigns: leadId, campaignName, emailSent, sentAt, status
emailTemplates: name, subject, htmlContent, isDefault
smtpSettings: smtpHost, smtpPort, emailUser, companyName
```

---

## 🎯 Typical Workflow

```
1. SETUP (5 min)
   └─ npm install → npm run dev → Open dashboard

2. CONFIGURE (5 min)
   └─ SMTP Settings → Enter credentials → Verify

3. ADD LEADS (5-30 min)
   └─ Add manually OR bulk upload CSV/Excel

4. CREATE TEMPLATE (10 min)
   └─ Design email → Use variables → Save

5. TEST (2 min)
   └─ Send to yourself → Verify variables work

6. SEND CAMPAIGN (1 min)
   └─ Select template → Select leads → Send

7. MONITOR (ongoing)
   └─ Check Dashboard for stats
```

---

## 🚀 Ready to Deploy?

1. Test locally: `npm run dev`
2. Commit to GitHub: `git push origin main`
3. Deploy to Vercel (auto-deploys from GitHub)
4. Go to your Vercel URL
5. System live in production! 🎉

See **VERCEL_DEPLOYMENT.md** for detailed instructions

---

## 📱 Device Support

✅ Desktop (Chrome, Firefox, Safari, Edge)
✅ Tablet (iPad, Android tablets)
✅ Mobile (iPhone, Android phones)
✅ Responsive design works everywhere

---

## 🔐 Security Checklist

✅ Use strong email passwords
✅ Never share SMTP credentials in code
✅ Keep `.env` files private
✅ Use HTTPS (Vercel provides free SSL)
✅ Enable 2FA on Gmail
✅ Rotate passwords periodically
✅ Don't commit `.env` files to GitHub

---

## 📚 All Files Included

**Code Files:**
- server.js (25 KB) - Backend
- package.json (879 B) - Dependencies
- public/index.html (19 KB) - Dashboard
- .env.example - Config template

**Documentation:**
- V2_COMPLETE_SUMMARY.md - Full overview
- UPGRADE_V2.md - V2.0 feature guide
- VERCEL_DEPLOYMENT.md - Deploy guide
- QUICKSTART.md - Quick setup
- SETUP.md - Detailed setup
- SSL_FIX.md - SSL help

---

## Version Info

- **Name**: Email Campaign Manager Pro
- **Version**: 2.0 (Enterprise)
- **Status**: Production Ready ✅
- **License**: MIT (Free to use)
- **Node**: v14+ required
- **Database**: SQLite (file-based)

---

## Quick Links

- **Dashboard**: http://localhost:3000 (local)
- **Vercel**: https://your-project.vercel.app (production)
- **GitHub**: Your repository
- **Email Provider Docs**: Check your provider

---

## Next Steps

1. **Read**: UPGRADE_V2.md (complete features)
2. **Deploy**: VERCEL_DEPLOYMENT.md (go live)
3. **Use**: Dashboard tabs for all features
4. **Monitor**: Check statistics regularly

---

## Support

📖 **Documentation**: All guides included
💻 **Code**: Well-commented and clean
🐛 **Issues**: Check SETUP.md troubleshooting
📧 **Deployment**: VERCEL_DEPLOYMENT.md

---

**You have everything to run a professional email campaign system!** 🚀

*Start with npm run dev → open http://localhost:3000*
*Configure SMTP in Settings tab*
*Add leads from Leads tab*
*Send campaigns from Send Campaigns tab*
*Monitor everything in Dashboard tab*

**Good luck!** 📧✨
