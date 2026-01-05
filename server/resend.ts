// Resend integration for sending emails
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendPasswordResetEmail(toEmail: string, resetCode: string, userName: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const result = await client.emails.send({
    from: fromEmail || 'noreply@resend.dev',
    to: toEmail,
    subject: 'Password Reset - Liquid Washes Laundry',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>You have requested to reset your password for Liquid Washes Laundry Management System.</p>
        <p>Your password reset code is:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #2563eb; letter-spacing: 8px; margin: 0;">${resetCode}</h1>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          Liquid Washes Laundry<br>
          Centra Market D/109, Al Dhanna City<br>
          Al Ruwais, Abu Dhabi - UAE<br>
          +971 50 123 4567
        </p>
      </div>
    `
  });
  
  return result;
}
