from pydantic import BaseModel, EmailStr
from typing import Optional


# ============================================================
# STUDENT / USER
# ============================================================

class Student(BaseModel):

    # --------------------------------------------------------
    # Common registration fields
    # --------------------------------------------------------

    name: str

    email: EmailStr

    password: str

    department: str

    role: str = "student"

    # --------------------------------------------------------
    # CLUB LEADER DETAILS
    #
    # These are optional because normal students do not need
    # to provide them.
    #
    # They become required by Register.jsx when the selected
    # role is "club".
    # --------------------------------------------------------

    student_id: Optional[str] = None

    college_name: Optional[str] = None

    club_name: Optional[str] = None

    club_category: Optional[str] = None

    position: Optional[str] = None

    coordinator_name: Optional[str] = None

    coordinator_email: Optional[EmailStr] = None


# ============================================================
# LOGIN
# ============================================================

class LoginRequest(BaseModel):

    email: EmailStr

    password: str

    role: str


# ============================================================
# STUDENT PROFILE
# ============================================================

class StudentProfile(BaseModel):

    year: str

    interests: list[str]

    skills: list[str]

    career_goal: str

    preferred_domains: list[str]


# ============================================================
# EVENT
# ============================================================

class Event(BaseModel):

    title: str

    description: str

    category: str

    organizer: str

    date: str

    time: str

    location: str

    skills: list[str]

    capacity: int

    poster_url: Optional[str] = None