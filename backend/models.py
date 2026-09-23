from pydantic import BaseModel, EmailStr


class Student(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class StudentProfile(BaseModel):
    year: str
    interests: list[str]
    skills: list[str]
    career_goal: str
    preferred_domains: list[str]

class Event(BaseModel):
    title: str
    description: str
    category: str
    organizer: str
    date: str
    time: str
    location: str
    skills: list[str]