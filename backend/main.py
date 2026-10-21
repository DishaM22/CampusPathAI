from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from database import db
from models import Student, LoginRequest, StudentProfile, Event
from typing import List, Optional
import re
from pwdlib import PasswordHash
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from otp import create_otp, verify_otp
import secrets
#from recommendation_engine import get_recommendations
import os
from dotenv import load_dotenv
from google import genai
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security
from pydantic import BaseModel, Field
import secrets
import hashlib
import logging
import smtplib

from email.message import EmailMessage

from pydantic import BaseModel, EmailStr

import time
from google.genai.errors import ServerError

# ============================================================
# GENERATIVE AI CONFIGURATION
# ============================================================

load_dotenv()

# ============================================================
# GENERATIVE AI CHAT REQUEST
# ============================================================

class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list)
# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI()

# ============================================================
# EVENT POSTERS
# ============================================================

POSTER_DIR = Path(__file__).resolve().parent / "uploads" / "posters"
POSTER_DIR.mkdir(parents=True, exist_ok=True)

POSTER_URL_PREFIX = "/uploads/posters/"
MAX_POSTER_BYTES = 3 * 1024 * 1024  # 3 MB

app.mount(
    POSTER_URL_PREFIX.rstrip("/"),
    StaticFiles(directory=str(POSTER_DIR)),
    name="event-posters",
)


# ============================================================
# EVENT REPORT PDFs
# ============================================================

REPORT_DIR = Path(__file__).resolve().parent / "uploads" / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

REPORT_URL_PREFIX = "/uploads/reports/"
MAX_REPORT_BYTES = 10 * 1024 * 1024  # 10 MB

app.mount(
    REPORT_URL_PREFIX.rstrip("/"),
    StaticFiles(directory=str(REPORT_DIR)),
    name="event-reports",
)


def detect_poster_type(data: bytes):
    """'png' / 'jpg' / 'webp' from the file's first bytes (not its name), else None."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def clean_poster_url(value):
    """None or "" -> None. Otherwise it must be a poster this server stored."""
    import re

    if value is None or str(value).strip() == "":
        return None

    value = str(value).strip()

    if not value.startswith(POSTER_URL_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid poster address.")

    name = value[len(POSTER_URL_PREFIX):]

    if not re.fullmatch(r"[0-9a-f]{32}\.(png|jpg|webp)", name):
        raise HTTPException(status_code=400, detail="Invalid poster address.")

    if not (POSTER_DIR / name).is_file():
        raise HTTPException(status_code=400, detail="Poster file not found. Please upload it again.")

    return value


def clean_report_url(value):
    """None or "" -> None. Otherwise it must be a report PDF this server stored."""
    import re

    if value is None or str(value).strip() == "":
        return None

    value = str(value).strip()

    if not value.startswith(REPORT_URL_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid report address.")

    name = value[len(REPORT_URL_PREFIX):]

    if not re.fullmatch(r"[0-9a-f]{32}\.pdf", name):
        raise HTTPException(status_code=400, detail="Invalid report address.")

    if not (REPORT_DIR / name).is_file():
        raise HTTPException(status_code=400, detail="Report file not found. Please upload it again.")

    return value


@app.post("/api/events/poster")
def upload_event_poster(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(authorization)

    try:
        user = db.students.find_one({"_id": ObjectId(student_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = user.get("role", "student")
    status = user.get("status", "active")

    if role not in ["club", "intercollege", "admin"]:
        raise HTTPException(status_code=403, detail="Only event organizers can upload posters.")

    if role in ["club", "intercollege"] and status != "active":
        raise HTTPException(status_code=403, detail="Your organization account is pending admin approval.")

    data = file.file.read(MAX_POSTER_BYTES + 1)

    if len(data) > MAX_POSTER_BYTES:
        raise HTTPException(status_code=413, detail="Poster is too large (maximum 3 MB).")

    extension = detect_poster_type(data)

    if not extension:
        raise HTTPException(status_code=400, detail="Poster must be a PNG, JPG or WEBP image.")

    name = secrets.token_hex(16) + "." + extension
    (POSTER_DIR / name).write_bytes(data)

    return {"status": "success", "poster_url": POSTER_URL_PREFIX + name}


# ============================================================
# UPLOAD EVENT REPORT PDF
# ============================================================

@app.post("/api/events/report")
def upload_event_report(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    # Authenticate the uploader
    student_id = get_student_id_from_token(authorization)

    if not student_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    try:
        user = db.students.find_one({"_id": ObjectId(student_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role = user.get("role", "student")
    status = user.get("status", "active")

    if role not in ["club", "intercollege", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only event organizers can upload reports."
        )

    if role in ["club", "intercollege"] and status != "active":
        raise HTTPException(
            status_code=403,
            detail="Your organization account is pending admin approval."
        )

    # Read at most 10 MB plus one byte
    data = file.file.read(MAX_REPORT_BYTES + 1)

    if len(data) > MAX_REPORT_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Report PDF must be 10 MB or smaller."
        )

    # Validate the actual PDF signature, not only the filename
    if not data.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF."
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a file with a .pdf extension."
        )

    # Generate a safe server-side filename
    filename = secrets.token_hex(16) + ".pdf"
    file_path = REPORT_DIR / filename

    file_path.write_bytes(data)

    return {
        "status": "success",
        "report_pdf_url": REPORT_URL_PREFIX + filename
    }


security = HTTPBearer()


import threading


def _warm_up_backend():
    """Pay the one-time start-up costs before the first student opens the dashboard."""
    import logging

    log = logging.getLogger("campuspath.startup")

    try:
        db.command("ping")  # opens the MongoDB connection
    except Exception:
        log.exception("MongoDB warm-up failed")

    try:
        import recommendation_engine  # slow first import

        # Load the semantic model now, not during the first dashboard
        # request (that request used to wait for it, or load it twice).
        recommendation_engine.get_embedding_model()
    except Exception:
        log.exception("Recommendation engine warm-up failed")


@app.on_event("startup")
def start_warm_up():
    threading.Thread(target=_warm_up_backend, daemon=True).start()
# ============================================================
# CORS
# ============================================================

# ============================================================
# CORS
# ============================================================

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# PASSWORD HASHING
# ============================================================

password_hash = PasswordHash.recommended()

# Password recovery email configuration
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = os.getenv("CAMPUSPATH_SMTP_EMAIL", "")
# Google shows app passwords in 4 groups with spaces; SMTP wants them without.
SMTP_APP_PASSWORD = os.getenv("CAMPUSPATH_SMTP_APP_PASSWORD", "").replace(" ", "")

# Shows up in the uvicorn terminal
mail_logger = logging.getLogger("uvicorn.error")


def send_password_reset_otp(recipient_email: str, otp: str):
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        raise RuntimeError("Password recovery email is not configured.")

    message = EmailMessage()
    message["Subject"] = "CampusPath AI - Password Reset OTP"
    message["From"] = SMTP_EMAIL
    message["To"] = recipient_email

    message.set_content(
        f"""Hello,

Your CampusPath AI password reset OTP is: {otp}

This OTP expires in 10 minutes and can only be used once.

If you did not request a password reset, please ignore this email.
"""
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        server.send_message(message)


def hash_reset_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = "campuspath-development-secret"

ALGORITHM = "HS256"


# ============================================================
# JWT HELPER
# ============================================================

def get_student_id_from_token(authorization: str):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token missing"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )

    token = authorization[len("Bearer "):].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization token missing"
        )

    try:

        decoded = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        student_id = decoded.get("student_id")

        if not student_id:
            raise HTTPException(
                status_code=401,
                detail="Student ID missing from token"
            )

        return student_id

    except jwt.ExpiredSignatureError as e:

        print("JWT ERROR: token expired:", repr(e))

        raise HTTPException(
            status_code=401,
            detail="Token expired. Please login again."
        )

    except jwt.InvalidTokenError as e:

        print("JWT ERROR: invalid token:", repr(e))

        raise HTTPException(
            status_code=401,
            detail="Invalid token. Please login again."
        )

    except Exception as e:

        print("JWT ERROR:", repr(e))

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "message": "CampusPath AI Backend is running!"
    }


# ============================================================
# MONGODB TEST
# ============================================================

@app.get("/api/test")
def test():

    try:

        db.command("ping")

        return {
            "status": "success",
            "message": "FastAPI and MongoDB are connected!"
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }


# ============================================================
# STUDENT REGISTRATION
# ============================================================

@app.post("/api/register")
def register_student(student: Student):

    # Normalize email
    email = student.email.strip().lower()

    # Get selected role
    role = getattr(student, "role", "student")

    # Check if email already exists
    existing_student = db.students.find_one(
        {"email": email}
    )

    if existing_student:

        return {
            "success": False,
            "status": "error",
            "message": "Email already registered"
        }

    # Hash password
    hashed_password = password_hash.hash(
        student.password
    )

    # Base student data
    student_data = {
        "name": student.name,
        "email": email,
        "password": hashed_password,
        "department": student.department,
        "role": role,
        "status": "active" if role == "student" else "pending",
        "submitted_at": datetime.now(timezone.utc)
    }

    # Students can give their college at signup (organizers see it)
    if role == "student":
        student_data["college_name"] = str(
            getattr(student, "college_name", "") or ""
        ).strip()

    # ========================================================
    # CLUB LEADER
    # DO NOT CHANGE THIS LOGIC
    # ========================================================

    if role == "club":

        student_data.update({
            "student_id": student.student_id,
            "college_name": student.college_name,
            "club_name": student.club_name,
            "club_category": student.club_category,
            "position": student.position,
            "coordinator_name": student.coordinator_name,
            "coordinator_email":
                str(student.coordinator_email).strip().lower()
                if student.coordinator_email
                else ""
        })

    # ========================================================
    # INTER-COLLEGE
    # ONLY INTER-COLLEGE DATA IS ADDED HERE
    # ========================================================

    if role == "intercollege":

        student_data.update({
            "student_id": getattr(
                student,
                "student_id",
                ""
            ),

            "college_name": getattr(
                student,
                "college_name",
                ""
            ),

            "club_name": getattr(
                student,
                "club_name",
                ""
            ),

            "club_category": getattr(
                student,
                "club_category",
                ""
            ),

            "position": getattr(
                student,
                "position",
                ""
            ),

            "coordinator_name": getattr(
                student,
                "coordinator_name",
                ""
            ),

            "coordinator_email":
                str(
                    getattr(
                        student,
                        "coordinator_email",
                        ""
                    ) or ""
                ).strip().lower()
        })

    # ========================================================
    # SAVE TO MONGODB
    # ========================================================

    result = db.students.insert_one(
        student_data
    )

    print("=" * 50)
    print("ACCOUNT CREATED SUCCESSFULLY")
    print(f"Name: {student.name}")
    print(f"Email: {email}")
    print(f"Role: {role}")
    print(f"MongoDB ID: {result.inserted_id}")

    if role == "intercollege":
        print("INTER-COLLEGE DETAILS:")
        print(
            f"College: {student_data.get('college_name', '')}"
        )
        print(
            f"Club: {student_data.get('club_name', '')}"
        )
        print(
            f"Category: {student_data.get('club_category', '')}"
        )
        print(
            f"Position: {student_data.get('position', '')}"
        )
        print(
            f"Coordinator: {student_data.get('coordinator_name', '')}"
        )
        print(
            f"Coordinator Email: "
            f"{student_data.get('coordinator_email', '')}"
        )

    print("=" * 50)

    # ========================================================
    # RESPONSE
    # IMPORTANT: THIS RETURN IS INSIDE THE FUNCTION
    # ========================================================

    return {

        "success": True,

        "status": "success",

        "message": "Account created successfully!",

        "student_id": str(
            result.inserted_id
        ),

        "name": student.name,

        "email": email,

        "department": student.department,

        "role": role

    }


# ============================================================
# LOGIN
# ============================================================


# ============================================================
# LOGIN
# ============================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


@app.post("/api/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    email = str(request.email).strip().lower()

    # Use the existing users collection.
    user = db.students.find_one({"email": email})

    # Don't reveal whether an account exists.
    generic_response = {
        "success": True,
        "message": (
            "If an account exists for this email, "
            "a password reset OTP has been sent."
        ),
    }

    if not user:
        return generic_response

    otp = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)

    # Store the OTP hash, not the plain OTP.
    db.students.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_otp_hash": hash_reset_otp(otp),
                "password_reset_expires_at": now + timedelta(minutes=10),
                "password_reset_attempts": 0,
            }
        },
    )

    try:
        send_password_reset_otp(email, otp)
    except Exception as exc:
        # Print the REAL reason in the backend terminal.
        mail_logger.error(
            "PASSWORD RESET EMAIL FAILED: %s: %s",
            type(exc).__name__,
            exc,
        )

        if isinstance(exc, RuntimeError):
            failure_detail = (
                "Password recovery email is not configured on the server."
            )
        elif isinstance(exc, smtplib.SMTPAuthenticationError):
            failure_detail = (
                "The server's email login was rejected. "
                "Check the Gmail app password."
            )
        else:
            failure_detail = (
                "Unable to send the recovery email. Please try again later."
            )

        # Invalidate the OTP if email delivery fails.
        db.students.update_one(
            {"_id": user["_id"]},
            {
                "$unset": {
                    "password_reset_otp_hash": "",
                    "password_reset_expires_at": "",
                }
            },
        )
        raise HTTPException(
            status_code=503,
            detail=failure_detail,
        )

    return generic_response


@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest):
    email = str(request.email).strip().lower()
    otp = request.otp.strip()
    new_password = request.new_password

    if not otp.isdigit() or len(otp) != 6:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters.",
        )

    now = datetime.now(timezone.utc)
    invalid_otp = HTTPException(
        status_code=400,
        detail="Invalid or expired OTP. Request a new OTP if needed.",
    )

    user = db.students.find_one({"email": email})

    if (
        not user
        or not user.get("password_reset_otp_hash")
        or not user.get("password_reset_expires_at")
    ):
        raise invalid_otp

    expires_at = user["password_reset_expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    attempts = int(user.get("password_reset_attempts", 0))

    # Expired, or too many wrong guesses: burn the OTP.
    if expires_at <= now or attempts >= 5:
        db.students.update_one(
            {"_id": user["_id"]},
            {"$unset": {
                "password_reset_otp_hash": "",
                "password_reset_expires_at": "",
                "password_reset_attempts": "",
            }},
        )
        raise invalid_otp

    if not secrets.compare_digest(
        user["password_reset_otp_hash"], hash_reset_otp(otp)
    ):
        db.students.update_one(
            {"_id": user["_id"]},
            {"$inc": {"password_reset_attempts": 1}},
        )
        raise invalid_otp

    # Use the same hasher as registration/login.
    new_password_hash = password_hash.hash(new_password)

    # Consume the OTP and update the password.
    result = db.students.update_one(
        {
            "_id": user["_id"],
            "password_reset_otp_hash": hash_reset_otp(otp),
            "password_reset_expires_at": {"$gt": now},
        },
        {
            "$set": {"password": new_password_hash},
            "$unset": {
                "password_reset_otp_hash": "",
                "password_reset_expires_at": "",
                "password_reset_attempts": "",
            },
        },
    )

    if result.modified_count != 1:
        raise HTTPException(
            status_code=400,
            detail="OTP already used or expired. Request a new OTP.",
        )

    return {
        "success": True,
        "message": "Password reset successfully. You can now log in.",
    }

@app.post("/api/login")
def login_student(login: LoginRequest):

    # Normalize login email
    email = login.email.strip().lower()

    # Find account by email
    student = db.students.find_one(
        {"email": email}
    )

    # Account not found
    if not student:

        return {

            "status": "error",

            "message": "Invalid email or password"

        }
    # ========================================================
    # VERIFY PASSWORD
    # ========================================================

    password_correct = password_hash.verify(
        login.password,
        student["password"]
    )

    if not password_correct:

        return {

            "status": "error",

            "message": "Invalid email or password"

        }

    # ========================================================
    # VERIFY ROLE
    # ========================================================
    #
    # The role selected on the login page must match
    # the role stored in MongoDB for this email.
    #
    # Example:
    #
    # MongoDB:
    # email = student@gmail.com
    # role  = student
    #
    # If user selects "club", login will be rejected.
    #
    # ========================================================

    registered_role = student.get(
        "role",
        "student"
    )

    if login.role != registered_role:

        return {

            "status": "error",

            "message":
                "This email is not registered for the selected role."

        }

    # ========================================================
    # ========================================================
    # CHECK ORGANIZATION ACCOUNT APPROVAL
    # ========================================================

    account_status = student.get(
        "status",
        "active"
    )

    # ========================================================
    # REJECTED ORGANIZATION ACCOUNT
    # ========================================================
    #
    # If an admin rejected the application, do not allow login.
    # Return the rejection message so the login page can display it.
    #
    if registered_role in ["club", "intercollege"] and account_status == "rejected":

        rejection_reason = str(
            student.get("rejection_reason", "")
        ).strip()

        rejection_note = str(
            student.get("rejection_note", "")
        ).strip()

        message = "Your organization registration has been rejected by the admin."

        if rejection_reason:
            message += f" Reason: {rejection_reason}"

        if rejection_note:
            message += f" Note: {rejection_note}"

        return {
            "status": "rejected",
            "message": message,
            "role": registered_role,
            "rejection_reason": rejection_reason,
            "rejection_note": rejection_note
        }

    # ========================================================
    # PENDING ORGANIZATION ACCOUNT
    # ========================================================

    if registered_role in ["club", "intercollege"] and account_status != "active":

        return {
            "status": "pending",

            "message":
                "Your organization account is pending admin approval.",

            "role": registered_role
        }

    # ========================================================
    # CREATE PERMANENT JWT TOKEN
    # ========================================================
    #
    # No "exp" claim is included.
    # Therefore this token does not expire.
    #
    # ========================================================

    token_data = {

        "student_id": str(
            student["_id"]
        ),

        "email": student["email"],

        "role": registered_role

    }

    token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    # ========================================================
    # LOGIN SUCCESS
    # ========================================================

    # ========================================================
    # CHECK ONBOARDING COMPLETION
    # ========================================================

    
    # ========================================================
    # CHECK ONBOARDING COMPLETION
    # ========================================================

    student_id = str(student["_id"])

    profile_exists = db.profiles.find_one({
        "student_id": student_id
    })

    timetable_exists = db.timetables.find_one({
        "student_id": student_id
    })

    onboarding_completed = (
        profile_exists is not None
        and timetable_exists is not None
    )

    print("=================================")
    print("ONBOARDING STATUS")
    print("Student ID:", student_id)
    print("Profile Exists:", profile_exists is not None)
    print("Timetable Exists:", timetable_exists is not None)
    print("Onboarding Completed:", onboarding_completed)
    print("=================================")

    # ========================================================
    # LOGIN SUCCESS
    # ========================================================

    response_data = {
        "status": "success",
        "message": "Login successful!",
        "token": token,
        "student_id": student_id,
        "name": student.get("name", ""),
        "email": student.get("email", ""),
        "department": student.get("department", ""),
        "role": registered_role,
        "onboarding_completed": onboarding_completed
    }

    print("LOGIN SUCCESS RESPONSE IS BEING RETURNED")
    print("LOGIN RESPONSE DATA:", response_data)

    return response_data



# ============================================================
# STUDENT PROFILE
# ============================================================

@app.post("/api/profile")
def save_profile(
    profile: StudentProfile,
    authorization: str = Header(None)
):

    student_id = get_student_id_from_token(
        authorization
    )

    profile_data = {

        "student_id": student_id,

        "year": profile.year,

        "interests": profile.interests,

        "skills": profile.skills,

        "career_goal": profile.career_goal,

        "preferred_domains": profile.preferred_domains

    }

    db.profiles.update_one(
        {"student_id": student_id},
        {"$set": profile_data},
        upsert=True
    )

    return {

        "status": "success",

        "message": "Profile saved successfully!"

    }

@app.get("/api/profile")
def get_profile(
    authorization: str = Header(None)
):

    student_id = get_student_id_from_token(
        authorization
    )

    profile = db.profiles.find_one(
        {
            "student_id": student_id
        }
    )

    if not profile:
        return {
            "interests": [],
            "skills": [],
            "career_goal": "",
            "preferred_domains": [],
            "year": ""
        }

    return {
        "interests": profile.get(
            "interests",
            []
        ),

        "skills": profile.get(
            "skills",
            []
        ),

        "career_goal": profile.get(
            "career_goal",
            ""
        ),

        "preferred_domains": profile.get(
            "preferred_domains",
            []
        ),

        "year": profile.get(
            "year",
            ""
        )
    }
# ============================================================
# STUDENT TIMETABLE
# ============================================================

@app.post("/api/student/timetable")
def save_student_timetable(
    timetable_data: dict,
    authorization: str = Header(None)
):

    # Decode and validate JWT
    student_id = get_student_id_from_token(
        authorization
    )

    # Prepare timetable data
    timetable_document = {

        "student_id": student_id,

        "timetable": timetable_data.get(
            "timetable",
            {}
        ),

        "config": timetable_data.get(
            "config",
            {}
        ),

        "preferences": timetable_data.get(
            "preferences",
            {}
        ),

        "updated_at": datetime.now(
            timezone.utc
        )
    }

    # Save / update timetable
    db.timetables.update_one(

        {
            "student_id": student_id
        },

        {
            "$set": timetable_document
        },

        upsert=True
    )

    return {

        "status": "success",

        "message":
            "Timetable saved successfully!"

    }
# ============================================================
# GET STUDENT TIMETABLE
# ============================================================

@app.get("/api/student/timetable")
def get_student_timetable(
    authorization: str = Header(None)
):

    # Decode and validate JWT
    student_id = get_student_id_from_token(
        authorization
    )

    # Find timetable for logged-in student
    timetable = db.timetables.find_one(
        {
            "student_id": student_id
        },
        {
            "_id": 0
        }
    )

    # No timetable found
    if not timetable:

        return {
            "status": "success",
            "timetable": {},
            "config": {},
            "preferences": {}
        }

    # Return saved timetable
    return {

        "status": "success",

        "timetable": timetable.get(
            "timetable",
            {}
        ),

        "config": timetable.get(
            "config",
            {}
        ),

        "preferences": timetable.get(
            "preferences",
            {}
        )

    }

# ============================================================
# INTER-COLLEGE DASHBOARD
# ============================================================

def iso_utc(value):
    """datetime -> '2026-10-21T09:35:40Z' so the browser can show local time."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value or "")


def json_safe(value):
    """
    Make Mongo documents safe to send as JSON: ObjectId -> text,
    datetime -> ISO text. One odd field in a single event used to make
    the whole /api/events request fail with a 500.
    """
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return iso_utc(value)

    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]

    return value


@app.get("/api/intercollege/dashboard")
def intercollege_dashboard(
    authorization: str = Header(None)
):
    """Return live dashboard data for the logged-in inter-college account."""

    student_id = get_student_id_from_token(authorization)

    try:
        user = db.students.find_one({
            "_id": ObjectId(student_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Inter-college account not found"
        )

    if user.get("role") != "intercollege":
        raise HTTPException(
            status_code=403,
            detail="Inter-college account required."
        )

    if user.get("status", "pending") != "active":
        raise HTTPException(
            status_code=403,
            detail="Your inter-college account is pending admin approval."
        )

    organization_name = (
        user.get("club_name")
        or user.get("organization_name")
        or user.get("college_name")
        or "Inter-College Organization"
    )

    college_name = (
        user.get("college_name")
        or user.get("college")
        or ""
    )

    initials = "".join(
        part[0].upper()
        for part in organization_name.split()
        if part
    )[:2] or "IC"

    # --------------------------------------------------------
    # EVENTS CREATED BY THIS INTER-COLLEGE ACCOUNT
    # --------------------------------------------------------

    event_query = {
        "$or": [
            {"created_by": student_id}
        ]
    }

    if ObjectId.is_valid(student_id):
        event_query["$or"].append({
            "created_by": ObjectId(student_id)
        })

    owned_events = list(
        db.events.find(event_query).sort("_id", -1)
    )

    # Remove duplicates
    unique_events = {}

    for event in owned_events:
        unique_events[str(event["_id"])] = event

    owned_events = list(unique_events.values())

    event_ids = [
        event["_id"]
        for event in owned_events
    ]

    event_id_strings = [
        str(event_id)
        for event_id in event_ids
    ]

    # --------------------------------------------------------
    # REGISTRATIONS
    # --------------------------------------------------------

    if event_ids:

        registration_query = {
            "$or": [
                {
                    "event_id": {
                        "$in": event_ids
                    }
                },
                {
                    "event_id": {
                        "$in": event_id_strings
                    }
                },
                {
                    "eventId": {
                        "$in": event_ids
                    }
                },
                {
                    "eventId": {
                        "$in": event_id_strings
                    }
                }
            ]
        }

        registrations = list(
            db.event_registrations.find(
                registration_query
            ).sort("_id", -1)
        )

    else:
        registrations = []

    # --------------------------------------------------------
    # UPCOMING EVENTS
    # --------------------------------------------------------

    upcoming_events = []

    for event in owned_events:

        event_id = str(event["_id"])

        registered_count = 0

        for registration in registrations:

            registration_event_id = (
                registration.get("event_id")
                or registration.get("eventId")
            )

            if str(registration_event_id) == event_id:
                registered_count += 1

        upcoming_events.append({
            "id": event_id,

            "title": event.get(
                "title",
                "Untitled Event"
            ),

            "category": event.get(
                "category",
                "Inter-College"
            ),

            "date": event.get(
                "date",
                ""
            ),

            "time": event.get(
                "time",
                ""
            ),

            "venue": event.get(
                "location",
                event.get(
                    "venue",
                    ""
                )
            ),

            "registered": registered_count,
            "description": event.get("description", ""),
            "organizer": event.get("organizer", ""),
            "skills": event.get("skills", []) or [],
            "poster_url": event.get("poster_url"),
            "report_pdf_url": event.get("report_pdf_url"),
            "resource_persons": event.get("resource_persons", []) or [],

            "capacity": event.get(
                "capacity",
                event.get(
                    "max_participants",
                    0
                )
            ),

            "status": event.get(
                "status",
                "draft"
            ),

            "colleges": event.get(
                "participating_colleges",
                event.get(
                    "colleges",
                    []
                )
            ) or []
        })

    upcoming_events = upcoming_events[:10]

    # --------------------------------------------------------
    # PARTICIPANT DETAILS
    # Registrations only store student_id/event_id, so the name,
    # department, year and college are looked up from the student
    # and profile records.
    # --------------------------------------------------------

    registered_student_ids = list({
        str(item.get("student_id"))
        for item in registrations
        if item.get("student_id")
    })

    student_lookup = {}
    profile_lookup = {}

    if registered_student_ids:
        student_object_ids = [
            ObjectId(item)
            for item in registered_student_ids
            if ObjectId.is_valid(item)
        ]

        for student_doc in db.students.find(
            {"_id": {"$in": student_object_ids}}
        ):
            student_lookup[str(student_doc["_id"])] = student_doc

        for profile_doc in db.profiles.find(
            {"student_id": {"$in": registered_student_ids}}
        ):
            profile_lookup[str(profile_doc.get("student_id"))] = profile_doc

    def first_text(*values):
        for value in values:
            text = str(value or "").strip()
            if text:
                return text
        return ""

    def registration_details(registration):
        sid = str(registration.get("student_id") or "")
        student_doc = student_lookup.get(sid, {})
        profile_doc = profile_lookup.get(sid, {})

        return {
            "participant": first_text(
                registration.get("name"),
                registration.get("student_name"),
                registration.get("participant_name"),
                student_doc.get("name"),
            ),
            "college": first_text(
                registration.get("college_name"),
                registration.get("college"),
                registration.get("university"),
                student_doc.get("college_name"),
                student_doc.get("college"),
                profile_doc.get("college_name"),
                profile_doc.get("college"),
            ),
            "department": first_text(
                registration.get("department"),
                student_doc.get("department"),
                profile_doc.get("department"),
            ),
            "year": first_text(
                registration.get("year"),
                registration.get("study_year"),
                profile_doc.get("year"),
            ),
        }

    # --------------------------------------------------------
    # PARTICIPATING COLLEGES
    # --------------------------------------------------------

    college_map = {}

    for registration in registrations:

        reg_college = registration_details(registration)["college"]

        if str(registration.get("status", "registered")).lower() == "cancelled":
            continue

        # Participants without a saved college are grouped together
        # instead of disappearing from the page.
        unspecified = not reg_college
        if unspecified:
            reg_college = "College not specified"

        if reg_college not in college_map:

            college_map[reg_college] = {
                "college": reg_college,
                "location": registration.get(
                    "location",
                    registration.get(
                        "city",
                        ""
                    )
                ),
                "contactPerson": registration.get(
                    "coordinator_name",
                    registration.get(
                        "contact_person",
                        ""
                    )
                ),
                "participants": 0,
                "events": set(),
                "status": "ACTIVE",
                "unspecified": unspecified
            }

        college_map[
            reg_college
        ]["participants"] += 1

        registration_event_id = (
            registration.get("event_id")
            or registration.get("eventId")
        )

        if registration_event_id is not None:

            college_map[
                reg_college
            ]["events"].add(
                str(registration_event_id)
            )

    participating_colleges = []

    for college in college_map.values():

        college["events"] = len(
            college["events"]
        )

        participating_colleges.append(
            college
        )

    # Real colleges first, the "not specified" group last
    participating_colleges.sort(key=lambda item: item["unspecified"])

    # --------------------------------------------------------
    # RECENT REGISTRATIONS
    # --------------------------------------------------------

    recent_registrations = []

    for registration in registrations[:10]:

        registration_event_id = (
            registration.get("event_id")
            or registration.get("eventId")
        )

        event = next(
            (
                item
                for item in owned_events
                if str(item["_id"])
                == str(registration_event_id)
            ),
            None
        )

        recent_registrations.append({

            "id": str(
                registration.get(
                    "_id",
                    ""
                )
            ),

            **registration_details(registration),

            "team": registration.get(
                "team_name",
                registration.get(
                    "team",
                    "Individual"
                )
            ),

            "event": registration.get(
                "event_title",
                event.get(
                    "title",
                    ""
                ) if event else ""
            ),

            "date": iso_utc(
                registration.get(
                    "registered_at",
                    registration.get("created_at", ""),
                )
            ),

            "status": str(
                registration.get(
                    "status",
                    "REGISTERED"
                )
            ).upper()
        })

    # --------------------------------------------------------
    # RETURN DASHBOARD DATA
    # --------------------------------------------------------

    return {

        "status": "success",

        "organization": {
            "name": organization_name,
            "initial": initials,
            "college": college_name
        },

        "kpis": {
            "totalEvents": len(
                owned_events
            ),

            "upcomingEvents": len(
                upcoming_events
            ),

            "participatingColleges": len([
                item for item in participating_colleges
                if not item.get("unspecified")
            ]),

            "totalRegistrations": len(
                registrations
            )
        },

        "upcomingEvents": upcoming_events,

        "participatingColleges":
            participating_colleges[:20],

        "recentRegistrations":
            recent_registrations
    }
# ============================================================
# ADMIN - PENDING ORGANIZATION APPLICATIONS
# ============================================================

@app.get("/api/admin/pending-applications")
def get_pending_applications(
    authorization: str = Header(None)
):

    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid admin user ID")

    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user not found")

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view pending applications."
        )

    applications = db.students.find({
        "role": {"$in": ["club", "intercollege"]},
        "status": "pending"
    }).sort("_id", -1)

    result = []

    for application in applications:
        role = application.get("role", "club")

        result.append({
            "id": str(application["_id"]),
            "name": application.get("name", ""),
            "email": application.get("email", ""),
            "phone": application.get("phone", ""),
            "department": application.get("department", ""),
            "role": role,
            "student_id": application.get("student_id", ""),
            "college_name": application.get("college_name", ""),
            "club_name": application.get("club_name", ""),
            "club_category": application.get("club_category", ""),
            "position": application.get("position", ""),
            "coordinator_name": application.get("coordinator_name", ""),
            "coordinator_email": application.get("coordinator_email", ""),
            "submitted_at": application.get("submitted_at", ""),
            "status": application.get("status", "pending")
        })

    return {
        "status": "success",
        "applications": result
    }


# ============================================================
# ADMIN - ORGANIZATIONS
# ============================================================

@app.get("/api/admin/organizations")
def get_admin_organizations(
    authorization: str = Header(None),
    status: str = "all",
    role: str = "all",
    search: str = ""
):
    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid admin user ID")

    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user not found")

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view organizations."
        )

    query = {
        "role": {"$in": ["club", "intercollege"]}
    }

    if status in ["pending", "active", "rejected"]:
        query["status"] = status

    if role in ["club", "intercollege"]:
        query["role"] = role

    applications = db.students.find(query).sort("_id", -1)

    q = search.strip().lower()
    result = []

    for organization in applications:
        organization_role = organization.get("role", "club")

        if organization_role == "intercollege":
            organization_name = (
                organization.get("club_name")
                or organization.get("organization_name")
                or organization.get("college_name")
                or "Inter-College Organization"
            )
        else:
            organization_name = (
                organization.get("club_name")
                or organization.get("organization_name")
                or "Club"
            )

        college_name = (
            organization.get("college_name")
            or organization.get("college")
            or ""
        )

        applicant_name = organization.get("name", "")
        email = organization.get("email", "")
        coordinator_name = organization.get("coordinator_name", "")
        coordinator_email = organization.get("coordinator_email", "")
        position = organization.get("position", "")
        organization_status = organization.get("status", "pending")

        if q:
            searchable = " ".join([
                organization_name,
                applicant_name,
                email,
                college_name,
                coordinator_name,
                coordinator_email,
                position,
                organization_role,
            ]).lower()

            if q not in searchable:
                continue

        submitted_at = organization.get("submitted_at")
        if hasattr(submitted_at, "strftime"):
            submitted_date = submitted_at.strftime("%b %d, %Y")
        elif submitted_at:
            submitted_date = str(submitted_at)
        else:
            submitted_date = ""

        result.append({
            "id": str(organization["_id"]),
            "organizationName": organization_name,
            "organizationType": organization_role,
            "college": college_name,
            "applicantName": applicant_name,
            "email": email,
            "phone": organization.get("phone", "") or organization.get("mobile", ""),
            "department": organization.get("department", ""),
            "studentId": organization.get("student_id", ""),
            "category": organization.get("club_category", "") or organization.get("category", ""),
            "position": position,
            "coordinatorName": coordinator_name,
            "coordinatorEmail": coordinator_email,
            "submittedAt": submitted_date,
            "status": organization_status,
        })

    return {
        "status": "success",
        "organizations": result,
        "count": len(result)
    }


# ============================================================
# ADMIN - REGISTRATIONS
# ============================================================

@app.get("/api/admin/registrations")
def get_admin_registrations(
    authorization: str = Header(None)
):
    """
    Return all event registrations for the admin Registrations page.
    If no students have registered yet, return an empty list.
    Passwords are never returned.
    """

    # --------------------------------------------------------
    # Verify JWT
    # --------------------------------------------------------

    admin_id = get_student_id_from_token(authorization)

    # --------------------------------------------------------
    # Verify admin account
    # --------------------------------------------------------

    try:
        admin_user = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin user ID"
        )

    if not admin_user:
        raise HTTPException(
            status_code=401,
            detail="Admin account not found."
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    # --------------------------------------------------------
    # Read registrations from MongoDB
    # --------------------------------------------------------

    registrations = db.event_registrations.find({}).sort(
        "_id",
        -1
    )

    result = []

    for registration in registrations:

        item = dict(registration)

    # --------------------------------------------------------
    # Registration ID
    # --------------------------------------------------------

        if "_id" in item:
            item["id"] = str(item.pop("_id"))

    # --------------------------------------------------------
    # GET STUDENT DETAILS
    # --------------------------------------------------------

        student = None

        try:
            student_id = registration.get("student_id")

            if student_id:
                student = db.students.find_one({
                    "_id": ObjectId(str(student_id))
                })
        except Exception:
            student = None

        if student:

            item["student_name"] = (
                student.get("name")
                or student.get("student_name")
                or student.get("studentName")
                or "Unknown Student"
            )

            item["student_email"] = (
                student.get("email")
                or ""
            )

            item["department"] = (
                student.get("department")
                or ""
            )

        else:

            item["student_name"] = "Unknown Student"
            item["student_email"] = ""
            item["department"] = ""

    # --------------------------------------------------------
    # GET EVENT DETAILS
    # --------------------------------------------------------

        event = None

        try:
            event_id = registration.get("event_id")

            if event_id:
                event = db.events.find_one({
                    "_id": ObjectId(str(event_id))
                })
        except Exception:
            event = None

        if event:

            item["event_name"] = (
                event.get("title")
                or event.get("event_name")
                or "Unknown Event"
            )

            item["organizer"] = (
                event.get("organizer")
                or event.get("organizer_name")
                or "—"
            )

            item["event_category"] = (
                event.get("category")
                or ""
            )

        else:

            item["event_name"] = (
                registration.get("event_title")
                or "Unknown Event"
            )

            item["organizer"] = "—"
            item["event_category"] = ""

    # --------------------------------------------------------
    # STATUS
    # --------------------------------------------------------

        item["status"] = registration.get(
            "status",
            "registered"
        )

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

        registered_at = registration.get(
            "registered_at"
        )

        if isinstance(registered_at, datetime):
            item["registered_at"] = (
                registered_at.isoformat()
            )

    # --------------------------------------------------------
    # CONVERT REMAINING OBJECT IDS
    # --------------------------------------------------------

        for key, value in list(item.items()):

            if isinstance(value, ObjectId):
                item[key] = str(value)

            elif isinstance(value, datetime):
                item[key] = value.isoformat()

        result.append(item)

    print(
    "ADMIN REGISTRATIONS:",
    result
)

    print("REGISTRATIONS FROM DATABASE:", result)

    # Empty collection is a valid state, not an error.
    return {
        "status": "success",
        "registrations": result,
        "total": len(result)
    }




# ============================================================
# ADMIN - EVENTS
# ============================================================

@app.get("/api/admin/events")
def get_admin_events(
    authorization: str = Header(None)
):
    """Return all events for the admin Events page."""

    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin user ID"
        )

    if not admin_user:
        raise HTTPException(
            status_code=401,
            detail="Admin account not found."
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    events = db.events.find({}).sort("_id", -1)

    result = []

    for event in events:
        item = dict(event)

        if "_id" in item:
            item["id"] = str(item.pop("_id"))

        for key, value in list(item.items()):
            if isinstance(value, datetime):
                item[key] = value.isoformat()
            elif isinstance(value, ObjectId):
                item[key] = str(value)

        result.append(item)

    return {
        "status": "success",
        "events": result,
        "total": len(result)
    }


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@app.get("/api/admin/dashboard")
def admin_dashboard(
    authorization: str = Header(None)
):
    # --------------------------------------------------------
    # Get logged-in user's ID from JWT
    # --------------------------------------------------------

    admin_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # Find logged-in account
    # --------------------------------------------------------

    try:
        admin_user = db.students.find_one(
            {
                "_id": ObjectId(admin_id)
            }
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if not admin_user:
        raise HTTPException(
            status_code=404,
            detail="Admin user not found"
        )

    # --------------------------------------------------------
    # Only administrators can access the dashboard
    # --------------------------------------------------------

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view the admin dashboard."
        )

    # ========================================================
    # ORGANIZATION APPLICATION COUNTS
    # ========================================================

    organization_roles = {
        "$in": ["club", "intercollege"]
    }

    pending_applications = db.students.count_documents(
        {
            "role": organization_roles,
            "status": "pending"
        }
    )

    approved_organizations = db.students.count_documents(
        {
            "role": organization_roles,
            "status": "active"
        }
    )

    rejected_applications = db.students.count_documents(
        {
            "role": organization_roles,
            "status": "rejected"
        }
    )

    # ========================================================
    # TOTAL USERS
    # ========================================================

    total_users = db.students.count_documents({})

    # ========================================================
    # PUBLISHED EVENTS
    # ========================================================

    published_events = db.events.count_documents(
        {
            "status": {
                "$in": ["published", "PUBLISHED"]
            }
        }
    )

    # ========================================================
    # TOTAL REGISTRATIONS
    # ========================================================

    total_registrations = db.event_registrations.count_documents({
    "status": "registered"
})

    # ========================================================
    # PENDING APPLICATION PREVIEW
    # ========================================================

    pending_documents = db.students.find(
        {
            "role": {
                "$in": ["club", "intercollege"]
            },
            "status": "pending"
        }
    ).sort(
        "_id",
        -1
    ).limit(10)

    pending_preview = []

    for application in pending_documents:

        organization_type = application.get(
            "role",
            "club"
        )

        if organization_type == "intercollege":
            organization_name = application.get(
                "college_name",
                ""
            )
        else:
            organization_name = application.get(
                "club_name",
                ""
            )

        submitted_at = application.get(
            "submitted_at",
            ""
        )

        if submitted_at:
            try:
                if hasattr(submitted_at, "strftime"):
                    submitted_date = submitted_at.strftime(
                        "%b %d, %Y"
                    )
                else:
                    submitted_date = str(
                        submitted_at
                    )
            except Exception:
                submitted_date = str(
                    submitted_at
                )
        else:
            submitted_date = ""

        pending_preview.append(
            {
                "id": str(
                    application["_id"]
                ),
                "applicantName": application.get(
                    "name",
                    ""
                ),
                "organizationName": organization_name,
                "organizationType": organization_type,
                "college": application.get(
                    "college_name",
                    ""
                ),
                "position": application.get(
                    "position",
                    ""
                ),
                "date": submitted_date,
                "status": application.get(
                    "status",
                    "pending"
                )
            }
        )

    # ========================================================
    # RETURN LIVE DATABASE DATA
    # ========================================================

    return {
        "status": "success",

        "kpis": {
            "pendingApplications": pending_applications,
            "approvedOrganizations": approved_organizations,
            "rejectedApplications": rejected_applications,
            "totalUsers": total_users,
            "publishedEvents": published_events,
            "totalRegistrations": total_registrations
        },

        "pendingPreview": pending_preview
    }


@app.get("/api/admin/users")
def get_admin_users(authorization: str = Header(None)):
    """
    Return all registered users for the admin Users page.
    Passwords are never returned.
    """

    # Check JWT
    admin_id = get_student_id_from_token(authorization)

    # Verify logged-in user is an admin
    admin_user = db.students.find_one({
        "_id": ObjectId(admin_id)
    })

    if not admin_user:
        raise HTTPException(
            status_code=401,
            detail="Admin account not found."
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    # Get all users
    users = db.students.find({}).sort("_id", -1)

    result = []

    for user in users:
        result.append({
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "role": user.get("role", "student"),
            "department": user.get("department", ""),
            "status": user.get("status", "active"),

            "student_id": user.get("student_id", ""),
            "college_name": user.get("college_name", ""),
            "club_name": user.get("club_name", ""),
            "club_category": user.get("club_category", ""),
            "position": user.get("position", ""),

            "phone": user.get("phone", ""),
            "year": user.get("year", ""),

            "submitted_at": (
                str(user["submitted_at"])
                if user.get("submitted_at")
                else None
            )
        })

    return {
        "status": "success",
        "users": result,
        "total": len(result)
    }

# ============================================================
# ADMIN - APPROVE APPLICATION
# ============================================================

@app.post("/api/admin/applications/{application_id}/approve")
def approve_admin_application(
    application_id: str,
    authorization: str = Header(None)
):

    # --------------------------------------------------------
    # Verify the logged-in user is an admin
    # --------------------------------------------------------

    admin_id = get_student_id_from_token(authorization)

    try:
        admin_object_id = ObjectId(admin_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin user ID"
        )

    admin_user = db.students.find_one({
        "_id": admin_object_id
    })

    if not admin_user:
        raise HTTPException(
            status_code=404,
            detail="Admin user not found"
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can approve applications."
        )

    # --------------------------------------------------------
    # Validate application ID
    # --------------------------------------------------------

    try:
        application_object_id = ObjectId(application_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid application ID"
        )

    # --------------------------------------------------------
    # Find the organization application
    # --------------------------------------------------------

    application = db.students.find_one({
        "_id": application_object_id,
        "role": {"$in": ["club", "intercollege"]}
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )

    # --------------------------------------------------------
    # Approve the organization
    # --------------------------------------------------------

    update_result = db.students.update_one(
        {
            "_id": application_object_id,
            "role": {"$in": ["club", "intercollege"]}
        },
        {
            "$set": {
                "status": "active",
                "approved_at": datetime.now(timezone.utc),
                "approved_by": admin_id
            },
            "$unset": {
                "rejection_reason": "",
                "rejection_note": "",
                "rejected_at": "",
                "rejected_by": ""
            }
        }
    )

    if update_result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )

    # --------------------------------------------------------
    # Record the approval in Activity Logs
    # --------------------------------------------------------

    create_activity_log(
        user_id=admin_id,
        user_name=admin_user.get("name", "Admin"),
        user_email=admin_user.get("email", ""),
        role="admin",
        action="Organization Application Approved",
        module="Applications",
        description=(
            f"Administrator approved the application for "
            f"{application.get('club_name') or application.get('college_name') or application.get('name', 'organization')}."
        ),
        related_id=application_id,
        status="success"
    )

    # --------------------------------------------------------
    # Create an admin notification for the approval action
    # --------------------------------------------------------

    try:
        db.notifications.insert_one({
            "title": "Organization Application Approved",
            "message": (
                f"{application.get('club_name') or application.get('college_name') or application.get('name', 'Organization')} "
                "was approved successfully."
            ),
            "type": "application",
            "recipient_role": "admin",
            "recipient": "admin",
            "related_id": application_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        })
    except Exception as e:
        # Notification failure must not undo a successful approval.
        print("NOTIFICATION CREATE ERROR:", repr(e))

    # --------------------------------------------------------
    # Return the updated status to the frontend
    # --------------------------------------------------------

    return {
        "status": "success",
        "message": "Application approved successfully.",
        "application_id": application_id,
        "application_status": "active",
        "applicationStatus": "active"
    }


# ============================================================
# ADMIN - REJECT APPLICATION
# ============================================================

@app.post("/api/admin/applications/{application_id}/reject")
def reject_admin_application(
    application_id: str,
    rejection_data: dict,
    authorization: str = Header(None)
):

    # Verify the logged-in user is an admin
    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin user ID"
        )

    if not admin_user:
        raise HTTPException(
            status_code=404,
            detail="Admin user not found"
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can reject applications."
        )

    # Find the organization application
    try:
        application = db.students.find_one({
            "_id": ObjectId(application_id),
            "role": {"$in": ["club", "intercollege"]}
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid application ID"
        )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )

    # Read rejection details sent by RejectModal
    reason = str(rejection_data.get("reason", "")).strip()
    note = str(rejection_data.get("note", "")).strip()

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required."
        )

    # Reject the organization
    db.students.update_one(
        {"_id": ObjectId(application_id)},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "rejection_note": note,
                "rejected_at": datetime.now(timezone.utc),
                "rejected_by": admin_id
            }
        }
    )

    return {
        "status": "success",
        "message": "Application rejected successfully.",
        "application_id": application_id,
        "application_status": "rejected",
        "reason": reason,
        "note": note
    }


# ============================================================
# ADMIN - VIEW FULL APPLICATION
# ============================================================

@app.get("/api/admin/applications/{application_id}")
def get_admin_application(
    application_id: str,
    authorization: str = Header(None)
):

    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user not found")

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view applications."
        )

    try:
        application = db.students.find_one({
            "_id": ObjectId(application_id),
            "role": {"$in": ["club", "intercollege"]}
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID")

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    role = application.get("role", "club")

    submitted_at = application.get("submitted_at")
    if submitted_at:
        submitted_at = str(submitted_at)
    else:
        try:
            submitted_at = application["_id"].generation_time.strftime("%B %d, %Y")
        except Exception:
            submitted_at = ""

    # Never expose password or MongoDB ObjectId directly.
    raw = dict(application)
    raw.pop("password", None)
    raw.pop("_id", None)
    raw["id"] = str(application["_id"])
    if "submitted_at" in raw:
        raw["submitted_at"] = str(raw["submitted_at"])

    return {
        "status": "success",
        "id": str(application["_id"]),
        "applicationStatus": application.get("status", "pending"),
        "submittedAt": submitted_at,
        "applicant": {
            "fullName": application.get("name", ""),
            "email": application.get("email", ""),
            "phone": application.get("phone", "") or application.get("mobile", ""),
            "department": application.get("department", ""),
            "studentId": application.get("student_id", ""),
            "college": application.get("college_name", "") or application.get("college", ""),
            "year": application.get("year", "")
        },
        "organization": {
            "type": role,
            "name": application.get("club_name", "") or application.get("organization_name", ""),
            "category": application.get("club_category", "") or application.get("category", ""),
            "position": application.get("position", ""),
            "description": application.get("description", ""),
            "coordinatorName": application.get("coordinator_name", ""),
            "coordinatorEmail": application.get("coordinator_email", ""),
            "officialContact": application.get("official_email", ""),
            "facultyCoordinator": application.get("faculty_coordinator_name", ""),
            "facultyCoordinatorContact": application.get("faculty_coordinator_contact", "")
        },
        "raw": raw
    }



# ============================================================
# ACTIVITY LOG HELPER
# ============================================================

def create_activity_log(
    user_id,
    user_name,
    user_email,
    role,
    action,
    module,
    description,
    related_id=None,
    status="success"
):
    """Save an activity log without breaking the main request."""

    try:
        db.activity_logs.insert_one({
            "user_id": str(user_id) if user_id else "",
            "user_name": user_name or "",
            "user_email": user_email or "",
            "role": role or "",
            "action": action or "",
            "module": module or "",
            "description": description or "",
            "related_id": str(related_id) if related_id else None,
            "status": status or "success",
            "created_at": datetime.now(timezone.utc)
        })
    except Exception as e:
        print("ACTIVITY LOG ERROR:", repr(e))


# ============================================================
# ADMIN - ACTIVITY LOGS
# ============================================================

@app.get("/api/admin/activity-logs")
def get_admin_activity_logs(
    authorization: str = Header(None)
):
    """Return real activity logs for administrators."""

    admin_id = get_student_id_from_token(authorization)

    try:
        admin_user = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin user ID"
        )

    if not admin_user:
        raise HTTPException(
            status_code=401,
            detail="Admin account not found."
        )

    if admin_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    logs = db.activity_logs.find({}).sort(
        "created_at",
        -1
    )

    result = []

    for log in logs:
        created_at = log.get("created_at")

        if created_at and hasattr(created_at, "isoformat"):
            created_at = created_at.isoformat()
        elif created_at:
            created_at = str(created_at)
        else:
            created_at = ""

        result.append({
            "id": str(log["_id"]),
            "user_id": str(log.get("user_id", "")),
            "user_name": log.get("user_name", "Unknown User"),
            "user_email": log.get("user_email", ""),
            "role": log.get("role", ""),
            "action": log.get("action", ""),
            "module": log.get("module", ""),
            "description": log.get("description", ""),
            "related_id": (
                str(log.get("related_id"))
                if log.get("related_id")
                else None
            ),
            "status": log.get("status", "success"),
            "created_at": created_at
        })

    return {
        "status": "success",
        "logs": result,
        "total": len(result)
    }


# ============================================================
# ADMIN NOTIFICATIONS
# ============================================================

@app.get("/api/admin/notifications")
def get_admin_notifications(
    authorization: str = Header(None)
):
    admin_id = get_student_id_from_token(authorization)

    try:
        admin = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin ID"
        )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Admin account not found"
        )

    if admin.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    notifications = list(
        db.notifications.find(
            {
                "$or": [
                    {"recipient_role": "admin"},
                    {"recipient": "admin"},
                    {"recipient": admin_id}
                ]
            }
        ).sort(
            "created_at",
            -1
        )
    )

    result = []

    for notification in notifications:
        result.append({
            "id": str(notification["_id"]),
            "title": notification.get("title", ""),
            "message": notification.get("message", ""),
            "type": notification.get("type", "system"),
            "is_read": bool(
                notification.get("is_read", False)
            ),
            "related_id": notification.get(
                "related_id"
            ),
            "created_at": str(
                notification.get(
                    "created_at",
                    ""
                )
            )
        })

    unread_count = sum(
        1
        for notification in result
        if not notification["is_read"]
    )

    return {
        "status": "success",
        "notifications": result,
        "total": len(result),
        "unread": unread_count
    }


@app.post("/api/admin/notifications/read-all")
def mark_all_notifications_read(
    authorization: str = Header(None)
):
    admin_id = get_student_id_from_token(authorization)

    try:
        admin = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin ID"
        )

    if not admin or admin.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    db.notifications.update_many(
        {
            "$or": [
                {"recipient_role": "admin"},
                {"recipient": "admin"},
                {"recipient": admin_id}
            ],
            "is_read": {
                "$ne": True
            }
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "status": "success",
        "message": "All notifications marked as read."
    }


@app.post("/api/admin/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    authorization: str = Header(None)
):
    admin_id = get_student_id_from_token(authorization)

    try:
        admin = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin ID"
        )

    if not admin or admin.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    try:
        object_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID"
        )

    result = db.notifications.update_one(
        {
            "_id": object_id
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc)
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {
        "status": "success",
        "message": "Notification marked as read."
    }


@app.delete("/api/admin/notifications/{notification_id}")
def delete_admin_notification(
    notification_id: str,
    authorization: str = Header(None)
):
    admin_id = get_student_id_from_token(authorization)

    try:
        admin = db.students.find_one({
            "_id": ObjectId(admin_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid admin ID"
        )

    if not admin or admin.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    try:
        object_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID"
        )

    result = db.notifications.delete_one({
        "_id": object_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {
        "status": "success",
        "message": "Notification deleted."
    }
# ============================================================
# RESOURCE PERSONS (speakers / judges / mentors)
# ============================================================

class ResourcePerson(BaseModel):
    name: str = ""
    designation: str = ""
    organization: str = ""
    linkedin_url: str = ""


class EventWithResources(Event):
    # None = the client did not send the field (leave existing data alone)
    resource_persons: Optional[List[ResourcePerson]] = None
    # None/"" = no report sent (keep whatever is stored)
    report_pdf_url: Optional[str] = None


def clean_resource_persons(persons):
    cleaned = []

    for person in (persons or [])[:20]:
        raw = (
            person.model_dump()
            if hasattr(person, "model_dump")
            else person.dict()
        )

        item = {
            key: str(raw.get(key) or "").strip()[:200]
            for key in (
                "name",
                "designation",
                "organization",
                "linkedin_url",
            )
        }

        if not any(item.values()):
            continue

        # Only http(s) links are kept
        if item["linkedin_url"] and not re.match(
            r"^https?://", item["linkedin_url"], re.I
        ):
            item["linkedin_url"] = ""

        cleaned.append(item)

    return cleaned


# ============================================================
# CREATE EVENT
# ============================================================

@app.post("/api/events")
def create_event(
    event: EventWithResources,
    authorization: str = Header(None)
):

    # --------------------------------------------------------
    # Get the logged-in user's ID from the JWT
    # --------------------------------------------------------

    student_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # Find the logged-in account
    # --------------------------------------------------------

    try:
        user = db.students.find_one(
            {
                "_id": ObjectId(student_id)
            }
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # --------------------------------------------------------
    # Check role and account status
    #
    # Students cannot create events.
    # Club / Intercollege accounts must be approved.
    # Admin accounts are allowed.
    # --------------------------------------------------------

    user_role = user.get(
        "role",
        "student"
    )

    user_status = user.get(
        "status",
        "active"
    )

    if user_role == "student":
        raise HTTPException(
            status_code=403,
            detail="Students are not allowed to create events."
        )

    if user_role in ["club", "intercollege"] and user_status != "active":
        raise HTTPException(
            status_code=403,
            detail="Your organization account is pending admin approval."
        )

    if user_role not in [
        "club",
        "intercollege",
        "admin"
    ]:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to create events."
        )

    # --------------------------------------------------------
    # Create event
    # --------------------------------------------------------

    event_data = {
        "title": event.title,
        "description": event.description,
        "category": event.category,
        "organizer": event.organizer,
        "date": event.date,
        "time": event.time,
        "location": event.location,
        "capacity": event.capacity,
        "skills": event.skills,
        "poster_url": clean_poster_url(event.poster_url),
        "report_pdf_url": clean_report_url(event.report_pdf_url),
        "resource_persons": clean_resource_persons(
            event.resource_persons
        ),
        "created_by": student_id,
        "created_by_role": user_role,
        "created_at": datetime.now(
            timezone.utc
        )
    }

    result = db.events.insert_one(
        event_data
    )

    return {
        "status": "success",
        "message": "Event created successfully!",
        "event_id": str(
            result.inserted_id
        )
    }


# ============================================================
# GET ALL EVENTS
# ============================================================

@app.get("/api/events")
def get_events():

    events = list(
        db.events.find()
    )

    return [json_safe(event) for event in events]
# -----------------------------
# Student Event Registration
# -----------------------------

@app.post("/api/events/{event_id}/register")
def register_for_event(
    event_id: str,
    authorization: str = Header(None)
):
    # Get logged-in student from JWT
    student_id = get_student_id_from_token(
        authorization
    )

    # Validate MongoDB event ID
    try:
        event_object_id = ObjectId(event_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # Check whether event exists
    event = db.events.find_one(
        {"_id": event_object_id}
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # Check existing active registration
    existing_registration = db.event_registrations.find_one({
        "student_id": student_id,
        "event_id": event_id,
        "status": "registered"
    })

    if existing_registration:
        return {
            "status": "already_registered",
            "message": "You are already registered for this event."
        }

    # --------------------------------------------------------
# CHECK AVAILABLE SEATS
# --------------------------------------------------------

    capacity = int(event.get("capacity", 0))

    registered_count = db.event_registrations.count_documents({
        "event_id": event_id,
        "status": "registered"
    })

    if capacity > 0 and registered_count >= capacity:
        raise HTTPException(
        status_code=400,
        detail="This event is full. No seats are available."
    )
    # Create registration
    registration = {
        "student_id": student_id,
        "event_id": event_id,
        "event_title": event.get("title", ""),
        "status": "registered",
        "registered_at": datetime.now(timezone.utc)
    }

    db.event_registrations.insert_one(
        registration
    )

    return {
        "status": "success",
        "message": "Successfully registered for the event.",
        "event_id": event_id
    }


# -----------------------------
# Get Student Registrations
# -----------------------------


@app.get("/api/events/registrations")
def get_student_registrations(
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(authorization)

    if not student_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication token"
        )

    registrations = list(
        db.event_registrations.find({
            "student_id": student_id
        })
    )

    registration_map = {}

    for registration in registrations:
        event_id = str(registration.get("event_id", ""))
        status = str(
            registration.get("status", "registered")
        ).lower()

        if not event_id:
            continue

        # Only show active registrations in My Registrations.
        if status == "registered":
            registration_map[event_id] = "Registered"
        elif status == "completed":
            registration_map[event_id] = "Completed"

    return registration_map


# -----------------------------
# Cancel Event Registration
# -----------------------------

@app.delete("/api/events/{event_id}/register")
def cancel_event_registration(
    event_id: str,
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    result = db.event_registrations.update_one(
        {
            "student_id": student_id,
            "event_id": event_id,
            "status": "registered"
        },
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(
                    timezone.utc
                )
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Registration not found"
        )

    return {
        "status": "success",
        "message": "Registration cancelled."
    }
# -----------------------------
# Get Student Saved Events
# -----------------------------

@app.get("/api/events/saved")
def get_saved_events(
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    saved_events = list(
        db.saved_events.find({
            "student_id": student_id
        })
    )

    saved_event_ids = []

    for item in saved_events:
        saved_event_ids.append(
            item.get("event_id")
        )

    return {
        "savedEventIds": saved_event_ids
    }
# ============================================================
# DASHBOARD EVENTS
# ============================================================

# ============================================================
# DASHBOARD EVENTS
# ============================================================

@app.get("/api/dashboard/events")
def dashboard_events(
    authorization: str = Header(None)
):
    """
    Get dashboard events and generate hybrid AI recommendations.

    The response keeps its original shape ("recommended", "upcoming").
    "engine_status" is new: "ok" or "error". On "error" the client should
    show plain upcoming events instead of inventing scores.
    """

    import logging

    recommendation_logger = logging.getLogger("campuspath.recommendations")

    # ---------------------------------------------------------
    # 1. GET STUDENT ID FROM JWT
    # ---------------------------------------------------------

    student_id = get_student_id_from_token(authorization)

    if not student_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication token"
        )

    # ---------------------------------------------------------
    # 2. GET STUDENT PROFILE
    # ---------------------------------------------------------

    profile = db.profiles.find_one({
        "student_id": student_id
    }) or {}

    # ---------------------------------------------------------
    # 3. GET STUDENT BASIC DATA
    # ---------------------------------------------------------

    try:
        student = db.students.find_one({
            "_id": ObjectId(student_id)
        }) or {}
    except Exception:
        student = db.students.find_one({
            "student_id": student_id
        }) or {}

    # ---------------------------------------------------------
    # 4. GET ALL EVENTS
    # ---------------------------------------------------------

    events = list(
        db.events.find({})
    )

    # Convert ObjectId to string
    for event in events:
        if "_id" in event:
            event["_id"] = str(event["_id"])

    # ---------------------------------------------------------
    # 5. GET REGISTERED EVENTS
    # ---------------------------------------------------------

    registrations = list(
        db.event_registrations.find({
            "student_id": student_id
        })
    )

    registered_ids = []

    for registration in registrations:
        status = registration.get("status", "registered")

        if status == "registered":
            event_id = registration.get("event_id")

            if event_id is not None:
                registered_ids.append(str(event_id))

    # ---------------------------------------------------------
    # 6. GET SAVED EVENTS
    # ---------------------------------------------------------

    saved_events = list(
        db.saved_events.find({
            "student_id": student_id
        })
    )

    saved_ids = []

    for saved_event in saved_events:
        event_id = saved_event.get("event_id")

        if event_id is not None:
            saved_ids.append(str(event_id))

    # ---------------------------------------------------------
    # 7. GET ATTENDED EVENTS
    # ---------------------------------------------------------

    attendance_records = list(
        db.attendance.find({
            "student_id": student_id
        })
    )

    attended_ids = []

    for attendance in attendance_records:
        event_id = attendance.get("event_id")

        if event_id is not None:
            attended_ids.append(str(event_id))

    # ---------------------------------------------------------
    # 8. GET STUDENT TIMETABLE
    #
    # The WHOLE saved document is passed to the engine (not only the
    # "timetable" part) so it can also read preferences.bufferTime.
    # ---------------------------------------------------------

    timetable_document = db.timetables.find_one({
        "student_id": student_id
    }) or {}

    # ---------------------------------------------------------
    # 9. SEATS TAKEN PER EVENT (used for availability)
    #
    # Cancelled registrations do not take a seat. If this query
    # fails, counts are simply left out and the engine treats
    # availability as unknown.
    # ---------------------------------------------------------

    registered_counts = {}

    try:
        for row in db.event_registrations.aggregate([
            {"$match": {"status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$event_id", "count": {"$sum": 1}}},
        ]):
            if row.get("_id") is not None:
                registered_counts[str(row["_id"])] = int(
                    row.get("count", 0)
                )
    except Exception:
        recommendation_logger.exception(
            "Could not count registrations per event"
        )
        registered_counts = None

    # ---------------------------------------------------------
    # 10. STUDENT FEATURES FOR THE ENGINE
    #
    # Only the fields the recommender needs. The full student
    # document (which includes the password hash) is NOT passed on.
    # ---------------------------------------------------------

    student_data = {
        "student_id": student_id,
        "department": student.get("department", ""),
        "year": profile.get("year", ""),
        "interests": profile.get("interests", []),
        "skills": profile.get("skills", []),
        "career_goal": profile.get("career_goal", ""),
        "preferred_domains": profile.get("preferred_domains", []),
    }

    # ---------------------------------------------------------
    # 11. GENERATE HYBRID RECOMMENDATIONS
    # ---------------------------------------------------------

    engine_status = "ok"

    try:
        # Import only when this endpoint is called, so a problem in the
        # engine cannot stop the whole FastAPI app from starting.
        from recommendation_engine import get_recommendations

        engine_events = []

        for event in events:
            engine_event = dict(event)

            if registered_counts is not None:
                engine_event["registered_count"] = registered_counts.get(
                    str(event.get("_id")), 0
                )

            engine_events.append(engine_event)

        recommended = get_recommendations(
            student=student_data,
            events=engine_events,
            feedback={
                "registered_ids": registered_ids,
                "saved_ids": saved_ids,
                "attended_ids": attended_ids
            },
            timetable=timetable_document,
            top_k=10
        )

        recommendation_logger.info(
            "recommendations generated: %s of %s events",
            len(recommended),
            len(events),
        )

    except Exception:
        recommendation_logger.exception("Recommendation engine failed")

        # Do NOT silently return events as recommendations,
        # because that would remove the scores.
        recommended = []
        engine_status = "error"

    # ---------------------------------------------------------
    # 12. RETURN DASHBOARD DATA
    # ---------------------------------------------------------

    return {
        "status": "success",
        "recommended": recommended,
        "upcoming": events,
        "engine_status": engine_status
    }
# ============================================================
# CLUB DASHBOARD
# ============================================================

# ============================================================
# CLUB DASHBOARD
# ============================================================

# ============================================================
# CLUB DASHBOARD
# ============================================================

@app.get("/api/club/notifications")
def get_club_notifications(
    authorization: str = Header(None)
):
    """Notifications (e.g. event edited / report added) for the logged-in organizer."""
    user_id = str(get_student_id_from_token(authorization))

    notifications = list(
        db.notifications.find(
            {"recipient": user_id, "type": "event_update"}
        ).sort("created_at", -1).limit(50)
    )

    return {
        "status": "success",
        "notifications": [
            {
                "id": str(n["_id"]),
                "title": n.get("title", ""),
                "message": n.get("message", ""),
                "type": n.get("type", "event_update"),
                "is_read": bool(n.get("is_read", False)),
                "related_id": n.get("related_id"),
                "created_at": (
                    n["created_at"].isoformat()
                    if hasattr(n.get("created_at"), "isoformat")
                    else str(n.get("created_at", ""))
                ),
            }
            for n in notifications
        ],
    }


@app.get("/api/club/dashboard")
def club_dashboard(
    authorization: str = Header(None)
):
    """
    Return dashboard data ONLY for the currently logged-in club.
    No sample/fallback data is used.
    """

    # --------------------------------------------------------
    # 1. Get logged-in user ID from JWT
    # --------------------------------------------------------

    try:
        student_id = get_student_id_from_token(
            authorization
        )
    except Exception as e:
        print("CLUB DASHBOARD JWT ERROR:", e)

        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication token."
        )

    print("========================================")
    print("CLUB DASHBOARD")
    print("LOGGED-IN USER ID:", student_id)
    print("========================================")

    # --------------------------------------------------------
    # 2. Find the logged-in club
    # --------------------------------------------------------

    try:

        club = None

        # First try ObjectId
        try:
            club_object_id = ObjectId(str(student_id))

            club = db.students.find_one({
                "_id": club_object_id
            })

        except Exception:
            club_object_id = None

        # If ObjectId lookup did not find the user,
        # also check string-based IDs.
        if not club:
            club = db.students.find_one({
                "student_id": str(student_id)
            })

        if not club:
            raise HTTPException(
                status_code=404,
                detail="Club account not found."
            )

    except HTTPException:
        raise

    except Exception as e:

        print(
            "CLUB DATABASE ERROR:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load club account."
        )

    # --------------------------------------------------------
    # 3. Verify this is actually a club account
    # --------------------------------------------------------

    role = str(
        club.get("role", "")
    ).lower().strip()

    if role != "club":

        raise HTTPException(
            status_code=403,
            detail="This account is not registered as a club."
        )

    # --------------------------------------------------------
    # 4. Get club name
    # --------------------------------------------------------

    club_name = str(
        club.get("club_name")
        or club.get("name")
        or club.get("organization_name")
        or "Your Club"
    ).strip()

    print("CLUB NAME:", club_name)

    # --------------------------------------------------------
    # 5. Find ONLY this club's events
    # --------------------------------------------------------

    try:

        event_query = {
            "$or": [

                # Events created using current system
                {
                    "created_by": str(student_id)
                },

                {
                    "createdBy": str(student_id)
                },

                # ObjectId versions for compatibility
                *(
                    [
                        {
                            "created_by":
                                club_object_id
                        },
                        {
                            "createdBy":
                                club_object_id
                        }
                    ]
                    if club_object_id
                    else []
                ),

                # Older event records
                {
                    "organizer": club_name
                },

                {
                    "club_name": club_name
                },

                {
                    "clubName": club_name
                }
            ]
        }

        events = list(
            db.events.find(
                event_query
            ).sort(
                "_id",
                -1
            )
        )

    except Exception as e:

        print(
            "CLUB EVENTS DATABASE ERROR:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load club events."
        )

    print(
        "CLUB EVENTS FOUND:",
        len(events)
    )

    # --------------------------------------------------------
    # 6. Prepare events for frontend
    # --------------------------------------------------------

    upcoming_events = []

    for event in events:

        event_id = str(
            event.get("_id", "")
        )

        title = str(
            event.get("title", "")
        )

        category = str(
            event.get("category", "")
        )

        date = str(
            event.get("date", "")
        )

        time = str(
            event.get("time", "")
        )

        location = str(
            event.get("location")
            or event.get("venue")
            or ""
        )

        status = str(
            event.get("status")
            or "PUBLISHED"
        )

        registered = event.get(
            "registered",
            0
        )

        capacity = event.get(
            "capacity",
            0
        )

        upcoming_events.append({

            "id": event_id,

            "title": title,

            "category": category,

            "date": date,

            "time": time,

            "venue": location,

            "registered": registered,

            "capacity": capacity,

            "status": status

        })

    # --------------------------------------------------------
    # 7. Calculate basic statistics
    # --------------------------------------------------------

    total_events = len(
        events
    )

    total_registrations = 0

    total_participants = 0

    for event in events:

        registered = event.get(
            "registered",
            0
        )

        try:
            registered = int(
                registered or 0
            )
        except:
            registered = 0

        total_registrations += registered

        total_participants += registered

    # --------------------------------------------------------
    # 8. Return REAL club data
    # --------------------------------------------------------

    response = {

        "club": {

            "name": club_name,

            "initial": (
                club_name[0].upper()
                if club_name
                else "C"
            )

        },

        "kpis": {

            "totalEvents":
                total_events,

            "upcomingEvents":
                total_events,

            "totalRegistrations":
                total_registrations,

            "totalParticipants":
                total_participants

        },

        "upcomingEvents":
            upcoming_events,

        "recentRegistrations":
            []

    }

    print(
        "CLUB DASHBOARD RESPONSE:",
        response
    )

    return response
# -----------------------------
# Get Student Saved Events
# -----------------------------

@app.get("/api/events/saved")
def get_saved_events(
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    saved_events = list(
        db.saved_events.find({
            "student_id": student_id
        })
    )

    saved_event_ids = []

    for item in saved_events:
        saved_event_ids.append(
            item.get("event_id")
        )

    return {
        "savedEventIds": saved_event_ids
    }



# ============================================================
# ATTENDANCE QR CODE
# ============================================================

@app.get("/api/events/{event_id}/attendance/qr")
def get_attendance_qr(
    event_id: str,
    authorization: str = Header(None)
):
    """
    Generate/retrieve the student's attendance QR token
    for a registered event.
    """

    # --------------------------------------------------------
    # Get logged-in student
    # --------------------------------------------------------

    student_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # Validate event ID
    # --------------------------------------------------------

    try:
        event_object_id = ObjectId(event_id)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # --------------------------------------------------------
    # Check event
    # --------------------------------------------------------

    event = db.events.find_one({
        "_id": event_object_id
    })

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # Check student's registration
    # --------------------------------------------------------

    registration = db.event_registrations.find_one({
        "student_id": student_id,
        "event_id": event_id,
        "status": "registered"
    })

    if not registration:
        raise HTTPException(
            status_code=403,
            detail="You are not registered for this event."
        )

    # --------------------------------------------------------
    # Generate attendance token if it doesn't exist
    # --------------------------------------------------------

    attendance_token = registration.get(
        "attendance_token"
    )

    if not attendance_token:

        attendance_token = secrets.token_urlsafe(32)

        db.event_registrations.update_one(
            {
                "_id": registration["_id"]
            },
            {
                "$set": {
                    "attendance_token": attendance_token
                }
            }
        )

    # --------------------------------------------------------
    # Return QR data
    # --------------------------------------------------------

    return {
        "status": "success",
        "event_id": event_id,
        "event_title": event.get(
            "title",
            ""
        ),
        "qr_data": attendance_token
    }


# ============================================================
# SCAN ATTENDANCE QR
# ============================================================

@app.post("/api/events/{event_id}/attendance/scan")
def scan_attendance_qr(
    event_id: str,
    payload: dict,
    authorization: str = Header(None)
):
    """
    Event leader scans student's QR code.

    Attendance is marked only when:
    1. The event exists.
    2. The scanner owns the event.
    3. The QR belongs to a registered student.
    4. The student has not already been marked present.
    """

    # --------------------------------------------------------
    # Get logged-in event leader
    # --------------------------------------------------------

    leader_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # Validate event ID
    # --------------------------------------------------------

    try:
        event_object_id = ObjectId(event_id)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # --------------------------------------------------------
    # Find event
    # --------------------------------------------------------

    event = db.events.find_one({
        "_id": event_object_id
    })

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # Verify event leader
    # --------------------------------------------------------

    if str(event.get("created_by")) != str(leader_id):

        raise HTTPException(
            status_code=403,
            detail="Only the event leader can mark attendance."
        )

    # --------------------------------------------------------
    # Get QR data
    # --------------------------------------------------------

    qr_data = payload.get(
        "qr_data"
    )

    if not qr_data:
        raise HTTPException(
            status_code=400,
            detail="QR code data is missing."
        )

    # --------------------------------------------------------
    # Find registration using QR token
    # --------------------------------------------------------

    registration = db.event_registrations.find_one({
        "event_id": event_id,
        "attendance_token": qr_data,
        "status": "registered"
    })

    if not registration:

        raise HTTPException(
            status_code=404,
            detail="Invalid QR code or student is not registered for this event."
        )

    # --------------------------------------------------------
    # Check if attendance already exists
    # --------------------------------------------------------

    existing_attendance = db.attendance.find_one({
        "event_id": event_id,
        "student_id": registration["student_id"]
    })

    if existing_attendance:

        return {
            "status": "already_marked",
            "message": "Attendance has already been marked.",
            "student_id": registration["student_id"],
            "event_id": event_id
        }

    # --------------------------------------------------------
    # Mark attendance
    # --------------------------------------------------------

    attendance_data = {
        "event_id": event_id,
        "student_id": registration["student_id"],
        "registration_id": str(
            registration["_id"]
        ),
        "status": "present",
        "marked_at": datetime.now(
            timezone.utc
        ),
        "marked_by": leader_id
    }

    db.attendance.insert_one(
        attendance_data
    )

    # --------------------------------------------------------
    # Return success
    # --------------------------------------------------------

    return {
        "status": "success",
        "message": "Attendance marked successfully.",
        "event_id": event_id,
        "student_id": registration["student_id"],
        "marked_at": attendance_data[
            "marked_at"
        ].isoformat()
    }


# ============================================================
# GET EVENT ATTENDANCE
# ============================================================

# ============================================================
# GET EVENT ATTENDANCE
# ============================================================

@app.get("/api/events/{event_id}/attendance")
def get_event_attendance(
    event_id: str,
    authorization: str = Header(None)
):
    """
    Event leader can view attendance for their event.

    Returns complete attendance information including:
    - Student name
    - Student ID
    - Email
    - Department
    - Event
    - Attendance status
    - Marked date/time
    """

    # --------------------------------------------------------
    # GET LOGGED-IN CLUB LEADER
    # --------------------------------------------------------

    leader_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # VALIDATE EVENT ID
    # --------------------------------------------------------

    try:
        event_object_id = ObjectId(event_id)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # --------------------------------------------------------
    # FIND EVENT
    # --------------------------------------------------------

    event = db.events.find_one({
        "_id": event_object_id
    })

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # VERIFY EVENT LEADER
    # --------------------------------------------------------

    if str(event.get("created_by")) != str(leader_id):

        raise HTTPException(
            status_code=403,
            detail="Only the event leader can view attendance."
        )

    # --------------------------------------------------------
    # GET ATTENDANCE
    # --------------------------------------------------------

    attendance_records = list(
        db.attendance.find({
            "event_id": event_id
        }).sort(
            "marked_at",
            1
        )
    )

    result = []

    # --------------------------------------------------------
    # PREPARE ATTENDANCE RECORDS
    # --------------------------------------------------------

    for index, record in enumerate(
        attendance_records,
        start=1
    ):

        student_id = str(
            record.get(
                "student_id",
                ""
            )
        )

        # ----------------------------------------------------
        # FIND STUDENT
        # ----------------------------------------------------

        student = None

        try:

            student = db.students.find_one({
                "_id": ObjectId(student_id)
            })

        except Exception:

            student = db.students.find_one({
                "student_id": student_id
            })

        # ----------------------------------------------------
        # STUDENT DETAILS
        # ----------------------------------------------------

        student_name = ""
        student_email = ""
        student_department = ""
        actual_student_id = student_id

        if student:

            student_name = student.get(
                "name",
                ""
            )

            student_email = student.get(
                "email",
                ""
            )

            student_department = student.get(
                "department",
                ""
            )

            if student.get("student_id"):

                actual_student_id = student.get(
                    "student_id"
                )

        # ----------------------------------------------------
        # MARKED TIME
        # ----------------------------------------------------

        marked_at = record.get(
            "marked_at"
        )

        if isinstance(
            marked_at,
            datetime
        ):

            india_timezone = timezone(
                timedelta(
                    hours=5,
                    minutes=30
                )
            )

            india_time = marked_at.astimezone(
                india_timezone
            )

            formatted_time = india_time.strftime(
                "%d %b %Y, %I:%M %p"
            )

        else:

            formatted_time = str(
                marked_at or ""
            )

        # ----------------------------------------------------
        # ADD RECORD
        # ----------------------------------------------------

        result.append({

            "no": index,

            "attendance_id": str(
                record.get(
                    "_id",
                    ""
                )
            ),

            "event_id": event_id,

            "event_name":
                event.get(
                    "title",
                    ""
                ),

            "student_id":
                actual_student_id,

            "name":
                student_name,

            "email":
                student_email,

            "department":
                student_department,

            "status":
                record.get(
                    "status",
                    "present"
                ),

            "marked_at":
                formatted_time,

            "marked_by":
                str(
                    record.get(
                        "marked_by",
                        ""
                    )
                )
        })

    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {

        "status": "success",

        "event_id":
            event_id,

        "event_name":
            event.get(
                "title",
                ""
            ),

        "total_attendance":
            len(result),

        "attendance":
            result
    }
# ============================================================
# GET SINGLE EVENT
# ============================================================

@app.get("/api/events/{event_id}")
def get_event(event_id: str):

    try:

        event = db.events.find_one(
            {
                "_id": ObjectId(event_id)
            }
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    if not event:

        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    event["_id"] = str(
        event["_id"]
    )

    return event

# ============================================================
# UPDATE EVENT
# ============================================================

# ============================================================
# UPDATE EVENT
# ============================================================

@app.put("/api/events/{event_id}")
def update_event(
    event_id: str,
    event: EventWithResources,
    authorization: str = Header(None)
):

    # --------------------------------------------------------
    # Get logged-in user
    # --------------------------------------------------------

    student_id = get_student_id_from_token(
        authorization
    )

    # --------------------------------------------------------
    # Validate event ID
    # --------------------------------------------------------

    try:

        event_object_id = ObjectId(event_id)

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # --------------------------------------------------------
    # Get existing event
    # --------------------------------------------------------

    existing_event = db.events.find_one(
        {
            "_id": event_object_id
        }
    )

    if not existing_event:

        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # Get logged-in user
    # --------------------------------------------------------

    try:

        user = db.students.find_one(
            {
                "_id": ObjectId(student_id)
            }
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # --------------------------------------------------------
    # CHECK ROLE
    # --------------------------------------------------------

    user_role = str(
        user.get(
            "role",
            ""
        )
    ).lower()

    if user_role not in [
        "club",
        "intercollege",
        "admin"
    ]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to update events."
        )

    # --------------------------------------------------------
    # CLUB OWNERSHIP CHECK
    # --------------------------------------------------------

    if user_role == "club":

        event_owner = existing_event.get(
            "created_by"
        )

        event_organizer = str(
            existing_event.get(
                "organizer",
                ""
            )
        ).strip().lower()

        club_name = str(
            user.get(
                "club_name",
                user.get(
                    "name",
                    ""
                )
            )
        ).strip().lower()

        # Allow the club that created the event
        # OR the club whose name matches organizer.

        owner_matches = (
            event_owner
            and str(event_owner) == str(student_id)
        )

        organizer_matches = (
            event_organizer
            and event_organizer == club_name
        )

        if not owner_matches and not organizer_matches:

            raise HTTPException(
                status_code=403,
                detail="You can only edit your own club events."
            )

    # --------------------------------------------------------
    # PREPARE UPDATED EVENT
    # --------------------------------------------------------

    update_data = {

        "title": event.title,

        "description": event.description,

        "category": event.category,

        "organizer": event.organizer,

        "date": event.date,

        "time": event.time,

        "location": event.location,

        "skills": event.skills,

    }

    # Seats available / capacity (was never saved on edit before)
    if event.capacity is not None:
        update_data["capacity"] = event.capacity

    if event.poster_url is not None:
        update_data["poster_url"] = clean_poster_url(event.poster_url)

    # Replace the report only when a new PDF was uploaded;
    # an empty value keeps the existing report.
    new_report_url = clean_report_url(event.report_pdf_url)
    report_changed = bool(
        new_report_url
        and new_report_url != existing_event.get("report_pdf_url")
    )

    if new_report_url:
        update_data["report_pdf_url"] = new_report_url

    # Only touch resource persons when the client actually sent them
    if event.resource_persons is not None:
        update_data["resource_persons"] = clean_resource_persons(
            event.resource_persons
        )

    # --------------------------------------------------------
    # UPDATE MONGODB
    # --------------------------------------------------------

    result = db.events.update_one(

        {
            "_id": event_object_id
        },

        {
            "$set": update_data
        }

    )

    # --------------------------------------------------------
    # CHECK UPDATE
    # --------------------------------------------------------

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # NOTIFY THE CLUB THAT THE EVENT WAS EDITED
    # --------------------------------------------------------

    try:
        event_title = event.title or existing_event.get("title", "Event")

        message = f'"{event_title}" was updated successfully.'

        if report_changed:
            message += " A new event report (PDF) was attached."

        recipients = {str(student_id)}

        if existing_event.get("created_by"):
            recipients.add(str(existing_event["created_by"]))

        for recipient_id in recipients:
            db.notifications.insert_one({
                "title": (
                    "Event Report Added"
                    if report_changed
                    else "Event Updated"
                ),
                "message": message,
                "type": "event_update",
                "recipient": recipient_id,
                "related_id": event_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            })
    except Exception as e:
        # A notification failure must not undo a successful update.
        print("EVENT UPDATE NOTIFICATION ERROR:", repr(e))

    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    return {

        "status": "success",

        "message": "Event updated successfully!",

        "event_id": event_id

    }


# ============================================================
# CANCEL EVENT REGISTRATION
# ============================================================

@app.delete("/api/events/{event_id}/register")
def cancel_event_registration(
    event_id: str,
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    result = db.event_registrations.update_one(
        {
            "student_id": student_id,
            "event_id": event_id,
            "status": "registered"
        },
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(
                    timezone.utc
                )
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Registration not found"
        )

    return {
        "status": "success",
        "message": "Registration cancelled."
    }


# ============================================================
# SAVE EVENT
# ============================================================

@app.post("/api/events/{event_id}/save")
def save_event(
    event_id: str,
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    try:
        event_object_id = ObjectId(event_id)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid event ID"
        )

    # Check event exists

    event = db.events.find_one(
        {
            "_id": event_object_id
        }
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # Check existing saved event

    existing = db.saved_events.find_one(
        {
            "student_id": student_id,
            "event_id": event_id
        }
    )

    if existing:
        return {
            "status": "already_saved",
            "message": "Event is already saved."
        }

    # Save event

    db.saved_events.insert_one(
        {
            "student_id": student_id,
            "event_id": event_id,
            "saved_at": datetime.now(
                timezone.utc
            )
        }
    )

    return {
        "status": "success",
        "message": "Event saved successfully.",
        "event_id": event_id
    }


# ============================================================
# REMOVE SAVED EVENT
# ============================================================

@app.delete("/api/events/{event_id}/save")
def remove_saved_event(
    event_id: str,
    authorization: str = Header(None)
):
    student_id = get_student_id_from_token(
        authorization
    )

    result = db.saved_events.delete_one(
        {
            "student_id": student_id,
            "event_id": event_id
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Saved event not found"
        )

    return {
        "status": "success",
        "message": "Event removed from saved events."
    }
    # --------------------------------------------------------
    # Only club / intercollege / admin can update
    # --------------------------------------------------------

    user_role = user.get(
        "role",
        "student"
    )

    if user_role not in [
        "club",
        "intercollege",
        "admin"
    ]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to update events."
        )

    # --------------------------------------------------------
    # Make sure club can edit its own event
    # --------------------------------------------------------

    if user_role == "club":

        event_owner = existing_event.get(
            "created_by"
        )

        event_organizer = existing_event.get(
            "organizer",
            ""
        )

        club_name = user.get(
            "club_name",
            user.get(
                "name",
                ""
            )
        )

        # Allow if the event was created by this club
        # OR the organizer matches the club name.

        if (
            event_owner
            and str(event_owner) != str(student_id)
            and event_organizer != club_name
        ):

            raise HTTPException(
                status_code=403,
                detail="You can only edit your own club events."
            )

    # --------------------------------------------------------
    # Update event
    # --------------------------------------------------------

    update_data = {

        "title": event.title,

        "description": event.description,

        "category": event.category,

        "organizer": event.organizer,

        "date": event.date,

        "time": event.time,

        "location": event.location,

        "skills": event.skills,

    }

    result = db.events.update_one(

        {
            "_id": ObjectId(event_id)
        },

        {
            "$set": update_data
        }

    )

    # --------------------------------------------------------
    # Check update
    # --------------------------------------------------------

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # Success
    # --------------------------------------------------------

    return {

        "status": "success",

        "message": "Event updated successfully!",

        "event_id": event_id

    }
# ============================================================
# SEND OTP
# ============================================================

@app.post("/send-otp")
def send_otp(email: str):

    try:

        # Generate OTP and send it to user's email
        create_otp(email)

        return {

            "success": True,

            "message":
                "OTP sent successfully to your email."

        }

    except Exception as e:

        print("=" * 50)
        print("OTP EMAIL ERROR")
        print(str(e))
        print("=" * 50)

        return {

            "success": False,

            "message":
                "Unable to send OTP email. Please try again."

        }


# ============================================================
# VERIFY OTP
# ============================================================

@app.post("/verify-otp")
def verify_otp_endpoint(
    email: str,
    otp: str
):

    success, message = verify_otp(
        email,
        otp
    )

    return {

        "success": success,

        "message": message

    }


# ============================================================
# CAMPUSPATH AI - GENERATIVE AI CHAT ASSISTANT
# ============================================================

@app.post("/api/ai/chat")
def ai_chat(
    payload: AIChatRequest,
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    authorization = f"Bearer {credentials.credentials}"
    """
    Generative AI assistant for CampusPathAI.

    Uses:
    - Authenticated student profile
    - Existing hybrid recommendations
    - Available campus events
    - Recent chat history
    """

    # --------------------------------------------------------
    # 1. VALIDATE MESSAGE AND API KEY
    # --------------------------------------------------------

    message = payload.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message."
        )

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Generative AI is not configured. Check the backend .env file."
        )

    # --------------------------------------------------------
    # 2. AUTHENTICATE STUDENT
    # --------------------------------------------------------

    student_id = get_student_id_from_token(authorization)

    # --------------------------------------------------------
    # 3. LOAD STUDENT PROFILE
    # --------------------------------------------------------

    profile = db.profiles.find_one({
        "student_id": student_id
    }) or {}

    try:
        student = db.students.find_one({
            "_id": ObjectId(student_id)
        }) or {}
    except Exception:
        student = db.students.find_one({
            "student_id": student_id
        }) or {}

    # Only include fields relevant to event recommendations.
    student_context = {
        "name": profile.get("name") or student.get("name", ""),
        "year": profile.get("year") or student.get("year", ""),
        "department": (
            profile.get("department")
            or student.get("department", "")
        ),
        "interests": profile.get("interests", []),
        "skills": profile.get("skills", []),
        "career_goal": profile.get("career_goal", ""),
        "preferred_domains": profile.get(
            "preferred_domains", []
        ),
    }

    # --------------------------------------------------------
    # 4. GET EXISTING EVENTS AND RECOMMENDATIONS
    # --------------------------------------------------------

    try:
        dashboard_data = dashboard_events(authorization)

        all_events = dashboard_data.get("upcoming", [])
        recommendations = dashboard_data.get("recommended", [])

    except Exception as exc:
        print("AI CHAT CONTEXT ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Unable to load campus events and recommendations."
        )

    # --------------------------------------------------------
    # 5. PREPARE COMPACT EVENT CONTEXT
    # --------------------------------------------------------

    def compact_event(item):
        if not isinstance(item, dict):
            return {}

        # Recommendation results may contain an inner event object.
        event = item.get("event", item)

        if not isinstance(event, dict):
            event = item

        return {
            "id": str(
                event.get("id")
                or event.get("_id")
                or event.get("event_id")
                or ""
            ),
            "title": event.get("title", ""),
            "category": (
                event.get("category")
                or event.get("cat")
                or ""
            ),
            "description": (
                event.get("description")
                or event.get("desc")
                or ""
            ),
            "date": str(event.get("date", "")),
            "time": event.get("time", ""),
            "venue": (
                event.get("venue")
                or event.get("location")
                or ""
            ),
            "organizer": (
                event.get("organizer")
                or event.get("org")
                or ""
            ),
            "skills": event.get("skills", []),
            "mode": event.get("mode", ""),
            "match_score": item.get(
                "matchScore",
                item.get("recommendationScore")
            ),
            "recommendation_reasons": item.get(
                "reasons",
                item.get("recommendationReason", [])
            ),
        }

    event_context = [
        compact_event(event)
        for event in all_events[:40]
    ]

    recommendation_context = [
        compact_event(event)
        for event in recommendations[:10]
    ]

    # --------------------------------------------------------
    # 6. PREPARE CONVERSATION HISTORY
    # --------------------------------------------------------

    history_messages = []

    for entry in payload.history[-8:]:
        if not isinstance(entry, dict):
            continue

        role = entry.get("role")
        content = entry.get("content", "")

        if (
            role in ("user", "assistant")
            and isinstance(content, str)
            and content.strip()
        ):
            history_messages.append({
                "role": role,
                "content": content[:2000]
            })

    # --------------------------------------------------------
    # 7. BUILD AI INSTRUCTIONS
    # --------------------------------------------------------

    system_prompt = f"""
You are CampusPath AI, a helpful generative AI assistant
integrated into a university campus event platform.

Your responsibilities:
1. Help students discover relevant campus events.
2. Explain why existing recommendations may be suitable.
3. Suggest events based on skills, interests and career goals.
4. Explain event details using the supplied event information.
5. Help students identify skills they can develop through events.
6. Answer general questions about learning and career preparation.

IMPORTANT RULES:
- Use the supplied student profile, events and recommendations.
- Prefer the existing hybrid recommendation results when suggesting
  personalized events.
- Do not invent events, dates, times, venues or registration details.
- If an event detail is unavailable, clearly say it is not available.
- Distinguish personalized recommendations from general suggestions.
- If no relevant event exists, say so honestly.
- Do not claim to register the student for an event.
- Be friendly, concise and practical.
- Use readable bullet points when listing events.
- Reply in plain text only. Do not use markdown symbols such as ** or #.
- Keep answers under about 150 words unless the student asks for more detail.

STUDENT PROFILE:
{__import__("json").dumps(student_context, default=str)}

EXISTING HYBRID RECOMMENDATIONS:
{__import__("json").dumps(recommendation_context, default=str)}

AVAILABLE CAMPUS EVENTS:
{__import__("json").dumps(event_context, default=str)}
"""

    # --------------------------------------------------------
    # 8. CALL GEMINI API
    # --------------------------------------------------------

    import logging
    from ai_gemini import AIServiceError, generate_with_fallback

    chat_logger = logging.getLogger("campuspath.chat")

    conversation = []

    for entry in history_messages:
        role = "Student" if entry["role"] == "user" else "CampusPath AI"
        conversation.append(f"{role}: {entry['content']}")

    conversation.append(f"Student: {message}")

    full_prompt = (
        system_prompt
        + "\n\nCONVERSATION:\n"
        + "\n".join(conversation)
        + "\n\nCampusPath AI:"
    )

    try:
        client = genai.Client(
            api_key=api_key,
            http_options={"timeout": 20000},  # milliseconds
        )

        answer = generate_with_fallback(client, full_prompt)

    except AIServiceError as exc:
        # Friendly message for the student; details stay in the server log.
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.public_message,
        )

    except Exception:
        chat_logger.exception("Unexpected AI chat error")
        raise HTTPException(
            status_code=502,
            detail="The AI assistant ran into a problem. Please try again.",
        )

    if not answer:
        answer = (
            "I couldn't generate a response just now. "
            "Please try asking your question again."
        )

    return {
        "status": "success",
        "answer": answer,
    }