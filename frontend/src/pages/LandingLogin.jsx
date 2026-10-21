import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingLogin.css";

function LandingLogin() {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [darkMode, setDarkMode] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [recoveryMode, setRecoveryMode] = useState(false);
const [recoveryStep, setRecoveryStep] = useState(1);
const [recoveryOtp, setRecoveryOtp] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmNewPassword, setConfirmNewPassword] = useState("");
const [recoveryMessage, setRecoveryMessage] = useState("");
const [recoveryError, setRecoveryError] = useState("");
const [recoveryLoading, setRecoveryLoading] = useState(false);

  const roleData = {
    student: {
      title: "Student",
      icon: "🎓",
      description:
        "Log in to discover personalized campus events and opportunities.",
      emailLabel: "Student email or ID",
      placeholder: "you@college.edu",
    },

    club: {
      title: "Club Leader",
      icon: "🏫",
      description:
        "Log in to create and manage events for your campus club.",
      emailLabel: "Club leader email or ID",
      placeholder: "club@college.edu",
    },

    intercollege: {
      title: "Inter-College",
      icon: "🌐",
      description:
        "Log in to manage inter-college events and opportunities.",
      emailLabel: "Organizer email or ID",
      placeholder: "organizer@college.edu",
    },

    admin: {
      title: "Admin",
      icon: "👨‍💼",
      description:
        "Log in to manage CampusPath AI and university activities.",
      emailLabel: "Admin email or ID",
      placeholder: "admin@college.edu",
    },
  };

  const currentRole = roleData[role];

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email/ID and password.");
      return;
    }

    setLoading(true);

    try {
      // ========================================================
      // CALL BACKEND LOGIN
      // ========================================================

      const response = await fetch(
        "http://127.0.0.1:8000/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password: password,
            role: role,
          }),
        }
      );

      



const rawResponse = await response.text();

console.log("LOGIN HTTP STATUS:", response.status);
console.log("LOGIN RAW RESPONSE:", rawResponse);

let data;

try {
  data = JSON.parse(rawResponse);
} catch {
  console.error("Login response was not valid JSON.");
  setError(
    `Login server returned an empty or invalid response (HTTP ${response.status}).`
  );
  return;
}

if (!data || typeof data !== "object") {
  setError("Invalid login response received from the server.");
  return;
}

console.log("LOGIN RESPONSE:", data);



      console.log(
        "LOGIN HTTP STATUS:",
        response.status
      );

      console.log(
        "LOGIN RESPONSE:",
        data
      );

      // ========================================================
      // LOGIN FAILED
      // ========================================================

      if (
        !response.ok ||
        !(
          data.success === true ||
          data.status === "success"
        )
      ) {
        setError(
          data.message ||
            data.detail ||
            "Invalid login credentials."
        );

        return;
      }

      // ========================================================
      // CHECK JWT TOKEN
      // ========================================================

      if (!data.token) {
        console.error(
          "Backend login succeeded but no JWT token was returned."
        );

        setError(
          "Login succeeded, but authentication token was not received."
        );

        return;
      }

      // ========================================================
      // SAVE JWT
      // ========================================================

      localStorage.setItem(
        "token",
        data.token
      );

      console.log(
        "JWT TOKEN SAVED SUCCESSFULLY"
      );

      // ========================================================
      // SAVE USER DATA
      // ========================================================

      localStorage.setItem(
        "user",
        JSON.stringify(data)
      );

      localStorage.setItem(
        "userEmail",
        email.trim()
      );

      localStorage.setItem(
        "userRole",
        role
      );

      // ========================================================
      // STUDENT
      // ========================================================

      if (role === "student") {

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

        // ======================================================
        // IMPORTANT:
        // NORMAL STUDENT LOGIN ALWAYS GOES TO DASHBOARD
        //
        // Profile Update / Onboarding is NOT handled here.
        // It should happen ONLY after a NEW STUDENT registers
        // and verifies OTP.
        // ======================================================

        console.log(
          "Student login successful → Dashboard"
        );

        navigate(
          "/dashboard"
        );

        return;
      }

      // ========================================================
      // CLUB LEADER
      // ========================================================

      if (role === "club") {

        navigate(
          "/club-dashboard"
        );

        return;
      }

      // ========================================================
      // INTER-COLLEGE
      // ========================================================

      if (
        role === "intercollege"
      ) {

        navigate(
          "/intercollege-dashboard"
        );

        return;
      }

      // ========================================================
      // ADMIN
      // ========================================================

      if (role === "admin") {

        navigate(
          "/admin"
        );

        return;
      }

    } catch (err) {

      console.error(
        "LOGIN ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to login."
      );

    } finally {

      setLoading(false);

    }

  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();

    setRecoveryMessage("");
    setRecoveryError("");

    if (!email.trim()) {
      setRecoveryError("Please enter your registered email.");
      return;
    }

    setRecoveryLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : data.message || "Unable to send OTP."
        );
      }

      setRecoveryMessage(
        data.message || "If your account exists, an OTP has been sent."
      );
      setRecoveryStep(2);
    } catch (err) {
      setRecoveryError(err.message || "Unable to send OTP.");
    } finally {
      setRecoveryLoading(false);
    }
  };


  const getErrorText = (data, fallback) => {
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    return fallback;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setRecoveryMessage("");
    setRecoveryError("");

    if (!/^\d{6}$/.test(recoveryOtp)) {
      setRecoveryError("Please enter the 6-digit OTP sent to your email.");
      return;
    }

    if (newPassword.length < 8) {
      setRecoveryError("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setRecoveryError("Passwords do not match.");
      return;
    }

    setRecoveryLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: recoveryOtp,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorText(data, "Unable to reset password.")
        );
      }

      setRecoveryStep(3);
      setRecoveryOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPassword("");
    } catch (err) {
      setRecoveryError(err.message || "Unable to reset password.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div
      className={`landing-page ${
        darkMode
          ? "landing-dark"
          : "landing-light"
      }`}
    >

      {/* ================= HEADER ================= */}

      <header className="landing-header">

        <div className="brand">

          <div className="brand-logo">
            CP
          </div>

          <div className="brand-name">
            CampusPath <span>AI</span>
          </div>

        </div>

      </header>


      {/* ================= MAIN ================= */}

      <main className="landing-main">

        {/* ================= LEFT ================= */}

        <section className="intro-section">

          <div className="intro-content">

            <h1>
              Find opportunities that
              <br />

              <span>
                move you forward.
              </span>
            </h1>

            <p className="intro-description">
              CampusPath AI intelligently
              discovers campus opportunities
              based on your interests, skills,
              and career goals — so you don't
              have to go looking.
            </p>

            <div className="feature-list">

              <div className="feature-item">

                <span>✓</span>

                <p>
                  Personalized events
                </p>

              </div>


              <div className="feature-item">

                <span>✓</span>

                <p>
                  AI recommendations
                </p>

              </div>


              <div className="feature-item">

                <span>✓</span>

                <p>
                  QR attendance & smart
                  reminders
                </p>

              </div>

            </div>

            <p className="built-for">
              Built for students, club leaders,
              inter-college organizers &
              university admins.
            </p>

          </div>

        </section>


        {/* ================= RIGHT ================= */}

        <section className="login-section">

          <div className="login-container">

            {/* Theme button */}

            <button
              className="theme-button"
              onClick={() =>
                setDarkMode(!darkMode)
              }
              type="button"
              aria-label="Toggle theme"
            >
              {darkMode ? "☾" : "☀"}
            </button>


            <div className="login-heading">

              <h2>
                Welcome back 👋
              </h2>

              <p>
                {currentRole.description}
              </p>

            </div>


            {/* ================= ROLE ================= */}

            <div className="role-heading">
              I am logging in as
            </div>


            <div className="role-selector">

              {Object.entries(
                roleData
              ).map(
                ([key, item]) => (

                  <button
                    key={key}
                    type="button"
                    className={`role-card ${
                      role === key
                        ? "active-role"
                        : ""
                    }`}
                    onClick={() => {
                      setRole(key);
                      setError("");
                    }}
                  >

                    <span className="role-icon">
                      {item.icon}
                    </span>

                    <span className="role-name">
                      {item.title}
                    </span>

                  </button>

                )
              )}

            </div>


            <p className="redirect-message">
              You'll be redirected to your{" "}
              {currentRole.title.toLowerCase()}
              dashboard.
            </p>


            {/* ================= LOGIN FORM ================= */}

            <form
              onSubmit={handleLogin}
            >

              <div className="form-group">

                <label>
                  {currentRole.emailLabel}
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder={
                    currentRole.placeholder
                  }
                  autoComplete="email"
                  required
                />

              </div>


              <div className="form-group">

                <label>
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />

              </div>


              <div className="login-options">

                <label className="remember">

                  <input
                    type="checkbox"
                  />

                  <span>
                    Remember me
                  </span>

                </label>


                <button
  type="button"
  className="forgot-password"
  onClick={() => {
    setRecoveryMode(true);
    setRecoveryStep(1);
    setRecoveryOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setRecoveryMessage("");
    setRecoveryError("");
  }}
>
  Forgot password?
</button>

              </div>


              {/* ERROR */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}


              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading
                  ? "Logging in..."
                  : "Log in"}
              </button>

            </form>

            {recoveryMode && (
  <div className="recovery-panel">
    <h3>
      {recoveryStep === 1
        ? "Forgot Password?"
        : recoveryStep === 2
          ? "Reset Your Password"
          : "Password Updated"}
    </h3>

    {recoveryStep === 1 && (
      <form onSubmit={handleRequestOtp}>
        <p>Enter your registered email to receive a recovery OTP.</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Registered email address"
          autoComplete="email"
          required
        />

        <button type="submit" disabled={recoveryLoading}>
          {recoveryLoading ? "Sending..." : "Send OTP"}
        </button>
      </form>
    )}

    {recoveryStep === 2 && (
      <form onSubmit={handleResetPassword}>
        <p>Enter the 6-digit OTP sent to your email.</p>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={recoveryOtp}
          onChange={(e) =>
            setRecoveryOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="6-digit OTP"
          required
        />

        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (minimum 8 characters)"
          autoComplete="new-password"
          minLength={8}
          required
        />

        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit" disabled={recoveryLoading}>
          {recoveryLoading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    )}

    {recoveryStep === 3 && (
      <p>Password reset successfully. You can now log in using your new password.</p>
    )}

    {recoveryMessage && (
      <p className="recovery-success">{recoveryMessage}</p>
    )}

    {recoveryError && (
      <p className="recovery-error">{recoveryError}</p>
    )}

    <button
      type="button"
      onClick={() => {
        setRecoveryMode(false);
        setRecoveryStep(1);
        setRecoveryError("");
        setRecoveryMessage("");
      }}
    >
      Back to Login
    </button>
  </div>
)}


            {/* ================= REGISTER ================= */}

            <div className="register-text">

              New to CampusPath AI?

              <button
                type="button"
                onClick={() =>
                  navigate("/register")
                }
              >
                Create an account
              </button>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default LandingLogin;