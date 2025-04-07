# Email Configuration Guide

This document explains how to set up and configure email functionality for the MeetingScribe application.

## Email Service Overview

The application uses email for:
- Sending OTP (One-Time Password) codes for signup verification
- Login authentication
- Password reset requests

## Configuration Options

You have two options for email configuration:

### Option 1: Use Ethereal for Development/Testing (No Configuration Required)

If you leave the SMTP settings empty in your `.env` file, the system will automatically create a test account with [Ethereal](https://ethereal.email/). This is perfect for development as:

- No real emails are sent
- Preview links are provided in the console
- The OTP is also logged to the console

### Option 2: Configure a Real SMTP Server

To send actual emails, configure these settings in your `.env` file:

```
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=your-email@example.com
```

## Gmail Configuration

To use Gmail as your SMTP provider:

1. Enable 2-Step Verification for your Google account
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. Generate an App Password
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Other" as the app, name it "MeetingScribe"
   - Copy the generated 16-character password

3. Update your `.env` file with:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=your-gmail@gmail.com
   ```

## Testing Email Functionality

To test if your email configuration is working:

1. Run the test script:
   ```
   node test-email.js
   ```

2. Check the console output:
   - If using Ethereal, a preview link will be displayed
   - If using a real SMTP server, check the specified email inbox

3. The test script will also verify OTP functionality

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if your SMTP_HOST and SMTP_PORT are correct
   - Ensure your network allows outgoing connections to that port

2. **Authentication Failed**
   - Verify your SMTP_USER and SMTP_PASS are correct
   - For Gmail, ensure you're using an App Password, not your regular password

3. **Gmail Specific**
   - Make sure 2-Step Verification is enabled
   - Use the App Password, not your regular Google password
   - If still not working, check if "Less secure app access" needs to be enabled

4. **Timeout Issues**
   - Some corporate networks block SMTP ports
   - Try using port 465 with SMTP_SECURE=true instead

## Development Notes

During development with `NODE_ENV=development`:

1. Fixed OTP code "123456" is used for convenience
2. All OTPs are logged to the console
3. When using Ethereal, email preview links are provided

## Production Considerations

For production:

1. Use a reliable SMTP provider (SendGrid, Mailgun, Amazon SES, etc.)
2. Ensure your FROM email has proper SPF, DKIM, and DMARC records to avoid spam filters
3. Consider adding email templates for better user experience
4. Monitor email delivery success rates 