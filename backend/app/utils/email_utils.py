import os
import smtplib
import random
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../.env"))

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of given length."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp: str, admin_name: str = "Admin") -> bool:
    """
    Send a 6-digit OTP to the given email address via Gmail SMTP.
    Returns True on success, False on failure.
    """
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("ERROR: GMAIL_USER or GMAIL_APP_PASSWORD not set in .env")
        return False

    subject = "Your Intervue.AI Admin Login OTP"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
              <tr>
                <td style="background:linear-gradient(135deg,#06b6d4,#2563eb);padding:32px 40px;text-align:center;">
                  <div style="display:inline-flex;align-items:center;gap:10px;">
                    <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:8px;display:inline-block;">
                      <span style="font-size:22px;">&#128272;</span>
                    </div>
                    <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Intervue.AI</span>
                  </div>
                  <p style="color:rgba(255,255,255,0.85);margin:10px 0 0 0;font-size:14px;">Admin Security Verification</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  <p style="color:#94a3b8;font-size:14px;margin:0 0 6px 0;">Hello, <strong style="color:#e2e8f0;">{admin_name}</strong></p>
                  <p style="color:#94a3b8;font-size:14px;margin:0 0 28px 0;">
                    A login attempt was made to the Intervue.AI Admin Portal. Use the OTP below to complete your sign-in.
                  </p>
                  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                    <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Your One-Time Password</p>
                    <div style="letter-spacing:16px;font-size:40px;font-weight:800;color:#38bdf8;font-family:'Courier New',monospace;padding-left:16px;">
                      {otp}
                    </div>
                    <p style="color:#64748b;font-size:12px;margin:14px 0 0 0;">Valid for <strong style="color:#f59e0b;">15 minutes</strong> only</p>
                  </div>
                  <div style="background:#172033;border-left:3px solid #f59e0b;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
                    <p style="color:#fbbf24;font-size:12px;font-weight:600;margin:0 0 4px 0;">Security Notice</p>
                    <p style="color:#94a3b8;font-size:12px;margin:0;">If you did not attempt to log in, your account may be at risk. Do not share this OTP with anyone.</p>
                  </div>
                  <p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Intervue.AI. Please do not reply to this email.</p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b;">
                  <p style="color:#334155;font-size:11px;margin:0;">(c) 2026 Intervue.AI · All rights reserved</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Intervue.AI <{GMAIL_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5.0) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        print(f"OTP email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send OTP email: {e}")
        return False
