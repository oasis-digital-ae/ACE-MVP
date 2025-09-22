# Email Configuration Guide for Production

## Problem
Users are not receiving signup confirmation emails in production.

## Solution Steps

### 1. Supabase Dashboard Configuration

#### A. SMTP Settings
1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. **Enable Custom SMTP**
3. Configure with your email provider:

**Gmail Configuration:**
```
SMTP Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: your-app-password
Sender Name: Football MVP
Sender Email: your-email@gmail.com
```

**SendGrid Configuration:**
```
SMTP Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: your-sendgrid-api-key
Sender Name: Football MVP
Sender Email: noreply@ace-mvp.netlify.app
```

#### B. Email Templates
1. Go to **Authentication** → **Email Templates**
2. Update **Confirm signup** template:

```html
<h2>Welcome to Football MVP!</h2>
<p>Click the link below to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create an account, you can ignore this email.</p>
```

3. Update **Reset password** template:

```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request this, you can ignore this email.</p>
```

#### C. URL Configuration
1. Go to **Authentication** → **URL Configuration**
2. Set:
   - **Site URL**: `https://ace-mvp.netlify.app`
   - **Redirect URLs**: 
     - `https://ace-mvp.netlify.app/**`
     - `http://localhost:5173/**`
     - `http://localhost:3000/**`
     - `http://localhost:8080/**`

### 2. Email Provider Setup

#### Gmail Setup (Free Option)
1. Enable 2-factor authentication
2. Generate App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this password in Supabase SMTP settings

#### SendGrid Setup (Recommended for Production)
1. Create SendGrid account
2. Verify sender identity
3. Generate API key
4. Configure SMTP settings in Supabase

#### Mailgun Setup (Alternative)
1. Create Mailgun account
2. Add and verify domain
3. Get SMTP credentials
4. Configure in Supabase

### 3. Domain Configuration

#### For Custom Domain Emails
1. **SPF Record**: Add to DNS
   ```
   v=spf1 include:sendgrid.net ~all
   ```

2. **DKIM Record**: Add to DNS (provided by email service)

3. **DMARC Record**: Add to DNS
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@ace-mvp.netlify.app
   ```

### 4. Testing

#### Test Email Delivery
1. Try creating a new account
2. Check spam folder
3. Check Supabase logs for errors
4. Test with different email providers (Gmail, Outlook, etc.)

#### Debug Steps
1. Check Supabase Dashboard → **Logs** → **Auth**
2. Look for SMTP errors
3. Verify email provider logs
4. Test SMTP connection manually

### 5. Common Issues

#### Issue: "SMTP connection failed"
- **Solution**: Check SMTP credentials and port
- **Check**: Firewall blocking port 587

#### Issue: "Authentication failed"
- **Solution**: Use App Password for Gmail
- **Check**: 2FA enabled for Gmail

#### Issue: "Emails going to spam"
- **Solution**: Configure SPF/DKIM records
- **Check**: Email content and sender reputation

#### Issue: "Template not found"
- **Solution**: Ensure email templates are configured
- **Check**: Template syntax and variables

### 6. Production Checklist

- [ ] SMTP settings configured
- [ ] Email templates updated
- [ ] Site URL set to production
- [ ] Redirect URLs include production domain
- [ ] Email provider verified
- [ ] SPF/DKIM records added
- [ ] Tested with multiple email providers
- [ ] Checked spam folders
- [ ] Monitored Supabase logs

## Quick Fix for Testing

If you need immediate testing, use Gmail SMTP:

1. **Enable 2FA** on your Gmail account
2. **Generate App Password** for Mail
3. **Configure Supabase SMTP**:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: `your-email@gmail.com`
   - Password: `your-app-password`
4. **Test signup** with a different email address

This should resolve the email delivery issue immediately.
