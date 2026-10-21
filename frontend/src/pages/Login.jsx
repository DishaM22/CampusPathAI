import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const [userRole, setUserRole] = useState("student");

    const handleLogin = async (e) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            // ==========================================
            // LOGIN REQUEST
            // ==========================================

            const response = await fetch(
                `${API_URL}/api/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        email: email.trim(),
                        password: password,
                        role: userRole,
                    }),
                }
            );

            const data = await response.json();

            console.log(
                "LOGIN HTTP:",
                response.status
            );

            console.log(
                "LOGIN RESPONSE:",
                data
            );

            // ==========================================
            // LOGIN FAILED
            // ==========================================

            if (
                !response.ok ||
                !(
                    data.success === true ||
                    data.status === "success"
                )
            ) {
                setMessage(
                    data.message ||
                    data.detail ||
                    "Invalid email or password."
                );

                return;
            }

            // ==========================================
            // CHECK JWT
            // ==========================================

            if (!data.token) {
                console.error(
                    "Login succeeded but no JWT token was returned."
                );

                setMessage(
                    "Login succeeded, but authentication token was not received."
                );

                return;
            }

            // ==========================================
            // SAVE JWT
            // ==========================================

            localStorage.setItem(
                "token",
                data.token
            );

            console.log(
                "JWT saved successfully."
            );

            // ==========================================
            // SAVE BASIC USER INFORMATION
            // ==========================================

            localStorage.setItem(
                "userEmail",
                email.trim()
            );

            localStorage.setItem(
                "userRole",
                userRole
            );

            // ==========================================
            // STUDENT INFORMATION
            // ==========================================

            if (userRole === "student") {

                const studentData = {
                    student_id:
                        data.student_id || "",

                    name:
                        data.name || "",

                    email:
                        data.email ||
                        email.trim(),

                    department:
                        data.department || "",

                    role:
                        data.role ||
                        "student",
                };

                localStorage.setItem(
                    "student",
                    JSON.stringify(studentData)
                );

                if (data.student_id) {
                    localStorage.setItem(
                        "student_id",
                        data.student_id
                    );
                }

                // ======================================
                // CHECK STUDENT ONBOARDING
                // ======================================

                const studentEmail =
                    (
                        data.email ||
                        email.trim()
                    )
                        .trim()
                        .toLowerCase();

                // Check onboarding status specifically
                // for this student's email
                const studentOnboardingKey =
                    `onboardingCompleted_${studentEmail}`;

                const studentOnboardingCompleted =
                    localStorage.getItem(
                        studentOnboardingKey
                    );

                // Keep compatibility with your
                // existing onboardingCompleted key
                const oldOnboardingCompleted =
                    localStorage.getItem(
                        "onboardingCompleted"
                    );

                console.log(
                    "STUDENT ONBOARDING KEY:",
                    studentOnboardingKey
                );

                console.log(
                    "STUDENT ONBOARDING COMPLETED:",
                    studentOnboardingCompleted
                );

                console.log(
                    "OLD ONBOARDING COMPLETED:",
                    oldOnboardingCompleted
                );

                // ======================================
                // EXISTING STUDENT
                // ======================================

                if (
                    studentOnboardingCompleted === "true" ||
                    oldOnboardingCompleted === "true"
                ) {
                    console.log(
                        "Existing student → Dashboard"
                    );

                    navigate("/dashboard");
                    return;
                }

                // ======================================
                // NEW STUDENT
                // ======================================

                console.log(
                    "New student → Student Onboarding"
                );

                navigate("/student/onboarding");
                return;
            }

            // ==========================================
            // CLUB LEADER
            // ==========================================

            if (userRole === "club") {
                navigate("/club-dashboard");
                return;
            }

            // ==========================================
            // INTER-COLLEGE
            // ==========================================

            if (
                userRole ===
                "intercollege"
            ) {
                navigate(
                    "/intercollege-dashboard"
                );

                return;
            }

            // ==========================================
            // ADMIN
            // ==========================================

            if (userRole === "admin") {
                navigate("/admin-dashboard");
                return;
            }

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            setMessage(
                "Unable to connect to the server. Please make sure the backend is running."
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <div>

            <form onSubmit={handleLogin}>

                <h2>
                    Welcome back 👋
                </h2>

                <label>
                    I am logging in as
                </label>

                <select
                    value={userRole}
                    onChange={(e) =>
                        setUserRole(
                            e.target.value
                        )
                    }
                >

                    <option value="student">
                        Student
                    </option>

                    <option value="club">
                        Club Leader
                    </option>

                    <option value="intercollege">
                        Inter-College
                    </option>

                    <option value="admin">
                        Admin
                    </option>

                </select>

                <input
                    type="email"
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(e) =>
                        setEmail(
                            e.target.value
                        )
                    }
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(
                            e.target.value
                        )
                    }
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Checking..."
                        : "Continue"}
                </button>

            </form>

            {message && (
                <p>
                    {message}
                </p>
            )}

        </div>
    );
}

export default Login;