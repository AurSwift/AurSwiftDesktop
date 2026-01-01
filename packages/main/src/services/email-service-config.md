# Email Service Configuration

The email service supports multiple providers. By default, it runs in "console" mode which logs emails instead of sending them.

## Configuration

To enable actual email sending, initialize the email service with proper configuration in `desktop/packages/main/src/index.ts`:

```typescript
await emailService.initialize({
  provider: "smtp", // or "console", "resend", "sendgrid"
  smtp: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "your-email@gmail.com",
      pass: "your-app-password",
    },
  },
  fromEmail: "noreply@yourbusiness.com",
  fromName: "Your Business Name",
});
```

## Environment Variables

You can also configure via environment variables:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourbusiness.com
EMAIL_FROM_NAME=Your Business Name
```

## Providers

### Console (Default)
- Logs emails to console
- No actual sending
- Useful for development/testing

### SMTP
- Standard SMTP server
- Works with Gmail, Outlook, custom SMTP servers
- Requires `nodemailer` package

### Resend (Future)
- Modern email API
- Requires Resend API key

### SendGrid (Future)
- Enterprise email service
- Requires SendGrid API key

## Installation

To enable SMTP sending, install nodemailer:

```bash
cd desktop/packages/main
npm install nodemailer
npm install --save-dev @types/nodemailer
```






