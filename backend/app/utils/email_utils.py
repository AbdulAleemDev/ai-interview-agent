import os
import random
import string
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../.env"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "re_XHJJbdhp_33fjyGzHwUUsu65gfBZ7LZHf")


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of given length."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp: str, admin_name: str = "Admin") -> bool:
    """
    Send a 6-digit OTP to the given email address via Resend HTTP API.
    Returns True on success, False on failure.
    """
    if not RESEND_API_KEY:
        print("ERROR: RESEND_API_KEY not configured")
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

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }

    # Resend free tier onboarding sender
    payload = {
        "from": "Intervue.AI <onboarding@resend.dev>",
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }

    try:
        res = requests.post("https://api.resend.com/emails", headers=headers, json=payload, timeout=8.0)
        if res.status_code in [200, 201]:
            print(f"OTP email sent successfully via Resend to {to_email}")
            return True
        else:
            print(f"Failed to send OTP email via Resend: {res.status_code} - {res.text}")
            return False
    except Exception as e:
        print(f"Failed to connect to Resend API: {e}")
        return False
