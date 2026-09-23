from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import db
from models import Student, LoginRequest, StudentProfile, Event
from pwdlib import PasswordHash
import jwt
from datetime import datetime, timedelta, timezone 
from bson import ObjectId

app = FastAPI()


# -----------------------------
# CORS
# -----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Password hashing
# -----------------------------

password_hash = PasswordHash.recommended()


# -----------------------------
# JWT configuration
# -----------------------------

SECRET_KEY = "campuspath-development-secret"

ALGORITHM = "HS256"


# -----------------------------
# Home
# -----------------------------

@app.get("/")
def home():

    return {
        "message": "CampusPath AI Backend is running!"
    }


# -----------------------------
# MongoDB test
# -----------------------------

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


# -----------------------------
# Student Registration
# -----------------------------

@app.post("/api/register")
def register_student(student: Student):

    existing_student = db.students.find_one(
        {"email": student.email}
    )

    if existing_student:

        return {
            "status": "error",
            "message": "Email already registered"
        }


    # Hash password
    hashed_password = password_hash.hash(
        student.password
    )


    student_data = {

        "name": student.name,

        "email": student.email,

        "password": hashed_password,

        "department": student.department

    }


    result = db.students.insert_one(
        student_data
    )


    return {

        "status": "success",

        "message": "Student registered successfully!",

        "student_id": str(
            result.inserted_id
        )

    }


# -----------------------------
# Student Login
# -----------------------------

@app.post("/api/login")
def login_student(login: LoginRequest):

    student = db.students.find_one(
        {"email": login.email}
    )


    if not student:

        return {

            "status": "error",

            "message": "Invalid email or password"

        }


    password_correct = password_hash.verify(
        login.password,
        student["password"]
    )


    if not password_correct:

        return {

            "status": "error",

            "message": "Invalid email or password"

        }


    # Create JWT token

    expiration = (
        datetime.now(timezone.utc)
        + timedelta(hours=2)
    )


    token_data = {

        "student_id": str(
            student["_id"]
        ),

        "email": student["email"],

        "exp": expiration

    }


    token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


    return {

        "status": "success",

        "message": "Login successful!",

        "token": token,

        "student_id": str(
            student["_id"]
        ),

        "name": student["name"],

        "department": student["department"]

    }

# -----------------------------
# Student Profile
# -----------------------------

@app.post("/api/profile")
def save_profile(
    profile: StudentProfile,
    authorization: str = Header(None)
):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token missing"
        )

    try:

        token = authorization.replace("Bearer ", "")

        decoded = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        student_id = decoded["student_id"]

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
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

# -----------------------------
# Create Event
# -----------------------------

@app.post("/api/events")
def create_event(event: Event):

    event_data = {

        "title": event.title,

        "description": event.description,

        "category": event.category,

        "organizer": event.organizer,

        "date": event.date,

        "time": event.time,

        "location": event.location,

        "skills": event.skills

    }

    result = db.events.insert_one(event_data)

    return {

        "status": "success",

        "message": "Event created successfully!",

        "event_id": str(result.inserted_id)

    }

# -----------------------------
# Get All Events
# -----------------------------

@app.get("/api/events")
def get_events():

    events = list(
        db.events.find()
    )

    for event in events:

        event["_id"] = str(
            event["_id"]
        )

    return events
# -----------------------------
# Dashboard Events
# -----------------------------

@app.get("/api/dashboard/events")
def dashboard_events(
    authorization: str = Header(None)
):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token missing"
        )

    try:

        token = authorization.replace("Bearer ", "")

        decoded = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        student_id = decoded["student_id"]

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


    # Get student profile

    profile = db.profiles.find_one(
        {"student_id": student_id}
    )


    # Get all events

    events = list(
        db.events.find()
    )


    # --------------------------------
    # If profile does not exist
    # --------------------------------

    if not profile:

        for event in events:

            event["_id"] = str(event["_id"])

        return {

            "recommended": [],

            "upcoming": events

        }


    interests = [
        item.lower()
        for item in profile.get(
            "interests", []
        )
    ]

    skills = [
        item.lower()
        for item in profile.get(
            "skills", []
        )
    ]

    domains = [
        item.lower()
        for item in profile.get(
            "preferred_domains", []
        )
    ]

    career_goal = profile.get(
        "career_goal",
        ""
    ).lower()


    # --------------------------------
    # Calculate recommendation score
    # --------------------------------

    scored_events = []


    for event in events:

        score = 0

        event_skills = [
            skill.lower()
            for skill in event.get(
                "skills", []
            )
        ]

        category = event.get(
            "category",
            ""
        ).lower()

        title = event.get(
            "title",
            ""
        ).lower()

        description = event.get(
            "description",
            ""
        ).lower()


        # Skill matching

        for skill in event_skills:

            if skill in skills:

                score += 3


            if skill in interests:

                score += 2


            if skill in domains:

                score += 2


        # Category matching

        for interest in interests:

            if interest in category:

                score += 2


            if interest in title:

                score += 2


            if interest in description:

                score += 1


        # Career goal matching

        career_words = career_goal.split()

        for word in career_words:

            if len(word) > 2:

                if word in title:
                    score += 2

                if word in description:
                    score += 1


        event["_id"] = str(
            event["_id"]
        )

        event["recommendation_score"] = score

        scored_events.append(event)


    # Sort by recommendation score

    scored_events.sort(
        key=lambda x: x[
            "recommendation_score"
        ],
        reverse=True
    )


    recommended = scored_events[:5]


    return {

        "recommended": recommended,

        "upcoming": events

    }

# -----------------------------
# Get Single Event
# -----------------------------

@app.get("/api/events/{event_id}")
def get_event(event_id: str):

    try:

        event = db.events.find_one(
            {"_id": ObjectId(event_id)}
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