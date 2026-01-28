# 🚀 Deploy to Vercel - Complete Guide

## Quick Overview

Your **Email Campaign Manager Pro v2.0** is ready for Vercel deployment!

The system works perfectly on Vercel with:
- ✅ Node.js backend
- ✅ Express server
- ✅ SQLite database
- ✅ File uploads
- ✅ Real-time dashboard

---

## Prerequisites

You need:
1. **GitHub account** (free at github.com)
2. **Vercel account** (free at vercel.com)
3. Your code in a GitHub repository
4. Email credentials for SMTP

---

## Step-by-Step Deployment

### Step 1: Create GitHub Repository

```bash
# Navigate to your project folder
cd email-automation-system

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Email campaign manager - ready for deployment"
```

### Step 2: Create GitHub Repository (Web)

1. Go to **github.com**
2. Click **"New repository"**
3. Name it: `email-campaign-manager`
4. Click **"Create repository"**

### Step 3: Push Code to GitHub

```bash
# Set remote (copy from GitHub repo page)
git remote add origin https://github.com/YOUR_USERNAME/email-campaign-manager.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Vercel

1. Go to **vercel.com**
2. Sign up with GitHub (if not already)
3. Click **"New Project"**
4. Click **"Import Git Repository"**
5. Select your `email-campaign-manager` repo
6. Click **"Import"**

### Step 5: Configure Environment Variables

1. In Vercel dashboard, go to **Settings → Environment Variables**
2. Add these variables:

```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_SECURE = false
EMAIL_USER = your-email@gmail.com
EMAIL_PASSWORD = your-app-password
COMPANY_NAME = Your Company Name
PORT = 3000
NODE_ENV = production
```

### Step 6: Deploy

1. Click **"Deploy"**
2. Wait for deployment (1-2 minutes)
3. You'll see: **"Congratulations! Your site is live"**
4. Copy the URL (like `email-manager-xyz.vercel.app`)

### Step 7: Access Your System

1. Go to your Vercel URL
2. You'll see the professional dashboard
3. Configure SMTP settings
4. Start sending campaigns! 🎉

---

## Environment Variables Explained

| Variable | Value | Example |
|----------|-------|---------|
| SMTP_HOST | Your email SMTP server | `smtp.gmail.com` |
| SMTP_PORT | SMTP port | `587` |
| SMTP_SECURE | Use encryption | `false` (for 587) |
| EMAIL_USER | Your email address | `your@gmail.com` |
| EMAIL_PASSWORD | Email app password | `xxxx-xxxx-xxxx-xxxx` |
| COMPANY_NAME | Your company name | `Real Estate Co` |
| PORT | Server port | `3000` (Vercel handles) |
| NODE_ENV | Environment | `production` |

---

## Gmail Setup

If using Gmail, follow these steps:

### 1. Enable 2-Step Verification
- Go to **myaccount.google.com**
- Click **"Security"**
- Under "2-Step Verification", click **"Get Started"**
- Follow steps

### 2. Create App Password
- Go to **myaccount.google.com/apppasswords**
- Select **Mail** → **Windows Computer**
- Copy the **16-character password**
- This goes in `EMAIL_PASSWORD` env variable

### 3. Set SMTP Variables
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_SECURE = false
EMAIL_USER = your-email@gmail.com
EMAIL_PASSWORD = your-16-char-app-password
```

---

## Using Other Email Providers

### SendGrid
```
SMTP_HOST = smtp.sendgrid.net
SMTP_PORT = 587
SMTP_SECURE = false
EMAIL_USER = apikey
EMAIL_PASSWORD = SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### AWS SES
```
SMTP_HOST = email-smtp.region.amazonaws.com
SMTP_PORT = 587
SMTP_SECURE = false
EMAIL_USER = your-smtp-username
EMAIL_PASSWORD = your-smtp-password
```

### Your Own Domain
```
SMTP_HOST = mail.yourdomain.com
SMTP_PORT = 587
SMTP_SECURE = false
EMAIL_USER = your-email@yourdomain.com
EMAIL_PASSWORD = your-password
```

---

## Custom Domain (Optional)

To use your own domain instead of vercel.app:

1. In Vercel dashboard, go to **Settings → Domains**
2. Enter your domain (e.g., campaigns.yourcompany.com)
3. Add DNS records (Vercel provides instructions)
4. Wait 10-30 minutes for DNS to propagate

---

## Updating Your System

After deployment, to make updates:

```bash
# Make changes locally
# Edit files as needed

# Commit and push
git add .
git commit -m "Your update message"
git push origin main

# Vercel automatically redeploys!
# Check Vercel dashboard for deployment status
```

---

## Database on Vercel

### Current Setup: SQLite (File-based)
- ✅ Works out of the box
- ✅ No external service needed
- ⚠️ Limited to 1 process (serverless limitation)
- For small teams: Perfect
- For large scale: Consider upgrade

### Future Upgrade: PostgreSQL
If you need to scale to thousands of leads:

1. Get PostgreSQL database (AWS RDS, DigitalOcean, etc.)
2. Update connection string in code
3. Migrate data
4. Redeploy

---

## Monitoring & Logs

### View Logs:
1. Go to Vercel dashboard
2. Click your project
3. Click **"Deployments"**
4. Click latest deployment
5. Click **"Logs"** tab
6. See real-time logs

### Check Status:
- Green checkmark = ✅ Running
- Red X = ⚠️ Error
- Gray circle = Building

---

## Limits & Quotas

### Vercel (Free Tier):
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Unlimited requests
- ✅ 1 second function timeout

### For Email Sending:
- ✅ Limited only by email provider
- Gmail: 500 emails/day (free)
- SendGrid: 100 emails/day (free), $20+/month (unlimited)

---

## Troubleshooting

### "Build failed"
Check Vercel logs:
1. Go to Deployment → Logs
2. Look for error messages
3. Common: Missing dependencies, syntax errors

### "Email not working"
1. Check environment variables are set
2. Go to dashboard Settings tab
3. Verify SMTP settings
4. Check Gmail app password is correct

### "Database errors"
1. Check logs for SQL errors
2. Try clearing browser cache
3. Restart Vercel deployment

### "Slow performance"
1. Normal for SQLite
2. Consider PostgreSQL upgrade
3. Vercel might sleep after inactivity (wake with request)

---

## Performance Tips

1. **Minimize File Uploads**: Keep CSV files < 5MB
2. **Batch Campaigns**: Send in batches if >500 leads
3. **Schedule Campaigns**: Use scheduling feature (if added)
4. **Monitor Database**: Delete old logs periodically

---

## Security Best Practices

1. ✅ Keep EMAIL_PASSWORD secret (env variable)
2. ✅ Use HTTPS (Vercel provides free SSL)
3. ✅ Enable 2FA on GitHub
4. ✅ Enable 2FA on Vercel
5. ✅ Never commit `.env` files
6. ✅ Rotate passwords periodically

---

## Scaling Considerations

### Current System (SQLite):
- ✅ Perfect for: < 10,000 leads
- ✅ Good for: < 50,000 leads
- ⚠️ Consider upgrade: > 50,000 leads

### When to Upgrade:
- Move to PostgreSQL database
- Add Redis caching
- Implement email queue system
- Load balancing

---

## Cost Breakdown

### Vercel (Free):
- $0/month
- Unlimited requests
- 100GB bandwidth

### Email Service:
- Gmail: $0/month (500 emails/day limit)
- SendGrid: $0 (100/day free) - $35/month (50k/month)
- AWS SES: ~$0.10 per 1000 emails

### Total Cost:
- **Minimal** (can stay free if low volume)
- **Scalable** (pay only for what you use)

---

## Post-Deployment Checklist

- [ ] Site is accessible at Vercel URL
- [ ] SMTP settings configured
- [ ] Test email sent and received
- [ ] Dashboard loads properly
- [ ] Can upload CSV file
- [ ] Can create templates
- [ ] Can send campaign
- [ ] Statistics show correctly
- [ ] Logs show no errors
- [ ] Backup database locally
- [ ] Custom domain configured (optional)

---

## Go Live Checklist

- [ ] Environment variables set in Vercel
- [ ] Gmail app password generated (if using Gmail)
- [ ] SMTP settings tested
- [ ] Sample campaign sent
- [ ] Dashboard verified working
- [ ] Team members can access
- [ ] Documentation reviewed
- [ ] Backup plan in place

---

## Support & Resources

- **Vercel Docs**: vercel.com/docs
- **Node.js Docs**: nodejs.org/docs
- **Gmail Setup**: support.google.com/accounts/answer/185833
- **Email Provider Docs**: Check your provider's SMTP guide

---

## Congratulations! 🎉

Your professional email campaign system is now:
- ✅ Live on the web
- ✅ Accessible 24/7
- ✅ Automatically scaling
- ✅ Enterprise-ready
- ✅ Fully customizable

**Start sending campaigns today!**

---

## Quick Reference

```
Your System: https://your-project.vercel.app
Dashboard: https://your-project.vercel.app
API: https://your-project.vercel.app/api

Configure in: Settings → SMTP Settings
Upload leads: Leads → Bulk Import
Send campaigns: Send Campaigns → Select Template
View stats: Dashboard
```

---

**Happy campaigning!** 🚀📧
