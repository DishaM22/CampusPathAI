import random
import time
import os
import smtplib

from email.message import EmailMessage
from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")


# ============================================================
# OTP STORAGE
# ============================================================

otp_storage = {}


# OTP validity period
OTP_EXPIRY_SECONDS = 5 * 60


# ============================================================
# SEND OTP EMAIL
# ============================================================

def send_otp_email(to_email: str, otp: str):

    if not SMTP_EMAIL:
        raise RuntimeError(
            "SMTP_EMAIL is not configured in the .env file."
        )

    if not SMTP_APP_PASSWORD:
        raise RuntimeError(
            "SMTP_APP_PASSWORD is not configured in the .env file."
        )

    message = EmailMessage()

    message["Subject"] = "CampusPath AI - Email Verification OTP"
    message["From"] = SMTP_EMAIL
    message["To"] = to_email

    message.set_content(
        f"""Hello,

Your CampusPath AI verification OTP is:

{otp}

This OTP is valid for 5 minutes.

If you did not request this OTP, please ignore this email.

Regards,
CampusPath AI Team
"""
    )

    # Connect, login, and send while the connection is open
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(
            SMTP_EMAIL,
            SMTP_APP_PASSWORD
        )
        server.send_message(message)
# ============================================================
# CREATE OTP
# ============================================================

def create_otp(email: str):

    # Normalize email
    email = email.strip().lower()

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))

    # Store OTP and expiry time
    otp_storage[email] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS
    }

    # Send OTP to user's email
    send_otp_email(
        email,
        otp
    )

    print("=" * 50)
    print(f"OTP EMAIL SENT TO: {email}")
    print("OTP VALID FOR: 5 MINUTES")
    print("=" * 50)

    return otp


# ============================================================
# VERIFY OTP
# ============================================================

def verify_otp(email: str, otp: str):

    # Normalize values
    email = email.strip().lower()
    otp = str(otp).strip()

    print("=" * 50)
    print("VERIFYING OTP")
    print(f"EMAIL: {email}")
    print(f"OTP RECEIVED: {otp}")
    print("=" * 50)

    # Check whether OTP exists
    stored_data = otp_storage.get(email)

    if stored_data is None:

        print("ERROR: OTP NOT FOUND")

        return False, "OTP not found or expired."

    # Check expiry
    if time.time() > stored_data["expires_at"]:

        print("ERROR: OTP EXPIRED")

        # Remove expired OTP
        del otp_storage[email]

        return False, "OTP not found or expired."

    # Compare OTP
    if stored_data["otp"] != otp:

        print("ERROR: INVALID OTP")

        return False, "Invalid OTP."

    # OTP is correct
    print("OTP VERIFIED SUCCESSFULLY")

    # Delete OTP after successful verification
    del otp_storage[email]

    return True, "OTP verified successfully."