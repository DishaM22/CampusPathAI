import React, { useState } from "react";

import { useNavigate, Link } from "react-router-dom";

import "../Auth.css";



const API_URL = "http://127.0.0.1:8000";



const roles = [

  {

    id: "student",

    label: "Student",

    icon: "🎓",

  },

  {

    id: "club",

    label: "Club Leader",

    icon: "🏫",

  },

  {

    id: "intercollege",

    label: "Inter-College",

    icon: "🌐",

  },

];



function Register() {

  const navigate = useNavigate();



  // ============================================================

  // FORM STATES

  // ============================================================



  const [role, setRole] = useState("student");



  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [department, setDepartment] = useState("");



  // ============================================================

  // CLUB LEADER DETAILS

  // ============================================================



  const [studentId, setStudentId] = useState("");

  const [collegeName, setCollegeName] = useState("");

  const [clubName, setClubName] = useState("");

  const [clubCategory, setClubCategory] = useState("");

  const [clubPosition, setClubPosition] = useState("");

  const [coordinatorName, setCoordinatorName] = useState("");

  const [coordinatorEmail, setCoordinatorEmail] = useState("");



  // ============================================================

  // INTER-COLLEGE DETAILS

  // ============================================================



  const [interCollegeName, setInterCollegeName] = useState("");

  const [interCollegeOrganization, setInterCollegeOrganization] = useState("");

  const [interCollegeCategory, setInterCollegeCategory] = useState("");

  const [interCollegePosition, setInterCollegePosition] = useState("");

  const [interCollegeCoordinatorName, setInterCollegeCoordinatorName] = useState("");

  const [interCollegeCoordinatorEmail, setInterCollegeCoordinatorEmail] = useState("");



  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");



  // ============================================================

  // OTP STATES

  // ============================================================



  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);



  // ============================================================

  // UI STATES

  // ============================================================



  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");



  const [showPassword, setShowPassword] = useState(false);



  // ============================================================

  // SEND OTP

  // ============================================================



  const handleRegister = async (e) => {

    e.preventDefault();



    setError("");

    setMessage("");



    // ----------------------------------------------------------

    // BASIC VALIDATION

    // ----------------------------------------------------------



    if (!name.trim()) {

      setError("Please enter your full name.");

      return;

    }



    if (!email.trim()) {

      setError("Please enter your college email.");

      return;

    }



    if (!department.trim()) {

      setError("Please enter your department.");

      return;

    }



    // ==========================================================

    // CLUB LEADER VALIDATION

    // ==========================================================



    if (role === "club") {

      if (!studentId.trim()) {

        setError("Please enter your Student ID / University ID.");

        return;

      }



      if (!collegeName.trim()) {

        setError("Please enter your college / university name.");

        return;

      }



      if (!clubName.trim()) {

        setError("Please enter your club name.");

        return;

      }



      if (!clubCategory.trim()) {

        setError("Please select your club category.");

        return;

      }



      if (!clubPosition.trim()) {

        setError("Please select your position in the club.");

        return;

      }



      if (!coordinatorName.trim()) {

        setError("Please enter the faculty / club coordinator name.");

        return;

      }



      if (!coordinatorEmail.trim()) {

        setError("Please enter the faculty / coordinator email.");

        return;

      }

    }



    // ==========================================================

    // INTER-COLLEGE VALIDATION

    // ==========================================================



    if (role === "intercollege") {

      if (!interCollegeName.trim()) {

        setError("Please enter your college / university name.");

        return;

      }



      if (!interCollegeOrganization.trim()) {

        setError("Please enter your organization / team name.");

        return;

      }



      if (!interCollegeCategory.trim()) {

        setError("Please select your club / organization category.");

        return;

      }



      if (!interCollegePosition.trim()) {

        setError("Please select your position.");

        return;

      }



      if (!interCollegeCoordinatorName.trim()) {

        setError("Please enter the coordinator name.");

        return;

      }



      if (!interCollegeCoordinatorEmail.trim()) {

        setError("Please enter the coordinator email.");

        return;

      }

    }



    // ----------------------------------------------------------

    // PASSWORD VALIDATION

    // ----------------------------------------------------------



    if (!password) {

      setError("Please enter a password.");

      return;

    }



    if (password.length < 6) {

      setError("Password must contain at least 6 characters.");

      return;

    }



    if (password !== confirmPassword) {

      setError("Passwords do not match.");

      return;

    }



    setLoading(true);



    try {

      console.log("Sending OTP to:", email);



      const otpResponse = await fetch(

        `${API_URL}/send-otp?email=${encodeURIComponent(email)}`,

        {

          method: "POST",

        }

      );



      console.log("OTP response status:", otpResponse.status);



      const otpData = await otpResponse.json();



      console.log("OTP response:", otpData);



      if (!otpResponse.ok || !otpData.success) {

        setError(

          otpData.message || "Unable to send OTP."

        );

        return;

      }



      // ========================================================

      // OTP SENT

      // ========================================================



      setOtpSent(true);



      setMessage(

        "A 6-digit OTP has been sent to your email. Please check your inbox."

      );

    } catch (error) {

      console.error("OTP ERROR:", error);



      setError(

        "Unable to connect to CampusPath AI server."

      );

    } finally {

      setLoading(false);

    }

  };



  // ============================================================

  // VERIFY OTP + CREATE ACCOUNT

  // ============================================================



    const handleVerifyAndCreate = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      // IMPORTANT: remove any previous account session first.
      // This prevents the new account from using an old user's JWT.
      localStorage.removeItem("token");
      localStorage.removeItem("student");
      localStorage.removeItem("user");
      localStorage.removeItem("student_id");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userRole");
      localStorage.removeItem("profileCompleted");

      // ========================================================
      // 1. VERIFY OTP
      // ========================================================

      const otpResponse = await fetch(
        `${API_URL}/verify-otp?email=${encodeURIComponent(
          email.trim().toLowerCase()
        )}&otp=${encodeURIComponent(otp)}`,
        { method: "POST" }
      );

      const otpText = await otpResponse.text();
      let otpData = {};

      try {
        otpData = otpText ? JSON.parse(otpText) : {};
      } catch {
        throw new Error(
          `OTP server returned invalid response (HTTP ${otpResponse.status}).`
        );
      }

      if (!otpResponse.ok || otpData.success !== true) {
        setError(
          otpData.message ||
            `OTP verification failed (HTTP ${otpResponse.status}).`
        );
        return;
      }

      // ========================================================
      // 2. CREATE ACCOUNT
      // ========================================================

      const registerResponse = await fetch(
        `${API_URL}/api/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            department: department.trim(),
            role,

            ...(role === "club"
              ? {
                  student_id: studentId.trim(),
                  college_name: collegeName.trim(),
                  club_name: clubName.trim(),
                  club_category: clubCategory,
                  position: clubPosition,
                  coordinator_name: coordinatorName.trim(),
                  coordinator_email:
                    coordinatorEmail.trim().toLowerCase(),
                }
              : {}),

            ...(role === "intercollege"
              ? {
                  college_name: interCollegeName.trim(),
                  club_name: interCollegeOrganization.trim(),
                  club_category: interCollegeCategory,
                  position: interCollegePosition,
                  coordinator_name:
                    interCollegeCoordinatorName.trim(),
                  coordinator_email:
                    interCollegeCoordinatorEmail.trim().toLowerCase(),
                }
              : {}),
          }),
        }
      );

      const registerText = await registerResponse.text();
      let registerData = {};

      try {
        registerData = registerText
          ? JSON.parse(registerText)
          : {};
      } catch {
        throw new Error(
          `Registration server returned invalid data (HTTP ${registerResponse.status}).`
        );
      }

      const registrationSucceeded =
        registerResponse.ok &&
        (registerData.success === true ||
          registerData.status === "success");

      if (!registrationSucceeded) {
        setError(
          registerData.message ||
            registerData.detail ||
            `Registration failed (HTTP ${registerResponse.status}).`
        );
        return;
      }

      console.log("NEW ACCOUNT CREATED:", registerData);

      // ========================================================
      // 3. CLUB / INTER-COLLEGE
      // ========================================================

      if (role === "club" || role === "intercollege") {
        setMessage(
          "Your organization account has been created and is pending administrator approval. You can log in after your application is approved."
        );
        return;
      }

      // ========================================================
      // 4. NEW STUDENT: AUTO-LOGIN THE NEW ACCOUNT
      // ========================================================
      // Do NOT send the new student to /login. If we do that,
      // an old session can be reused. Instead obtain a fresh JWT
      // for the account that was just registered.

      if (role === "student") {
        const loginResponse = await fetch(
          `${API_URL}/api/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
              role: "student",
            }),
          }
        );

        const loginText = await loginResponse.text();
        let loginData = {};

        try {
          loginData = loginText
            ? JSON.parse(loginText)
            : {};
        } catch {
          throw new Error(
            `New student login returned invalid data (HTTP ${loginResponse.status}).`
          );
        }

        const loginSucceeded =
          loginResponse.ok &&
          (loginData.success === true ||
            loginData.status === "success");

        if (!loginSucceeded || !loginData.token) {
          console.error(
            "NEW STUDENT AUTO LOGIN FAILED:",
            loginData
          );

          setError(
            loginData.message ||
              loginData.detail ||
              "Account was created, but automatic login failed. Please login manually."
          );
          return;
        }

        // ======================================================
        // 5. SAVE ONLY THE NEW STUDENT'S SESSION
        // ======================================================

        const newStudent = {
          student_id:
            loginData.student_id ||
            registerData.student_id ||
            "",
          name:
            loginData.name ||
            name.trim(),
          email:
            loginData.email ||
            email.trim().toLowerCase(),
          department:
            loginData.department ||
            department.trim(),
          role:
            loginData.role ||
            "student",
        };

        localStorage.setItem(
          "token",
          loginData.token
        );

        localStorage.setItem(
          "user",
          JSON.stringify(loginData)
        );

        localStorage.setItem(
          "student",
          JSON.stringify(newStudent)
        );

        localStorage.setItem(
          "userEmail",
          newStudent.email
        );

        localStorage.setItem(
          "userRole",
          "student"
        );

        if (newStudent.student_id) {
          localStorage.setItem(
            "student_id",
            newStudent.student_id
          );
        }

        // New registration must ALWAYS open profile update.
        localStorage.removeItem(
          "profileCompleted"
        );

        localStorage.removeItem(
          `onboardingCompleted_${newStudent.email.toLowerCase()}`
        );

        console.log(
          "NEW STUDENT SESSION CREATED:",
          newStudent
        );

        setMessage(
          "Account created successfully! Let's complete your profile."
        );

        setTimeout(() => {
          navigate(
            "/student/onboarding",
            { replace: true }
          );
        }, 500);

        return;
      }

      navigate("/login", { replace: true });

    } catch (error) {
      console.error(
        "========== REGISTRATION ERROR =========="
      );
      console.error(error);
      console.error(
        "========================================="
      );

      setError(
        error?.message ||
          "Could not connect to the CampusPath AI server."
      );
    } finally {
      setLoading(false);
    }
  };

// RETURN UI

  // ============================================================



  return (

    <div className="auth-page">



      {/* ======================================================

          LEFT SIDE

          ====================================================== */}



      <section className="auth-left">



        <div>



          {/* LOGO */}



          <div className="logo">



            <div className="logo-icon">

              CP

            </div>



            <span>

              CampusPath

            </span>



            <span className="logo-ai">

              AI

            </span>



          </div>





          {/* HERO CONTENT */}



          <div className="hero-content">



            <h1>

              Your campus.

              <br />

              Your opportunities.

            </h1>



            <p>

              Create your CampusPath AI account

              and let intelligent recommendations

              help you discover events that match

              your skills, interests and goals.

            </p>





            {/* FEATURES */}



            <div className="feature-list">



              <div className="feature">



                <span className="feature-check">

                  ✓

                </span>



                Personalized event discovery



              </div>





              <div className="feature">



                <span className="feature-check">

                  ✓

                </span>



                AI-powered recommendations



              </div>





              <div className="feature">



                <span className="feature-check">

                  ✓

                </span>



                Smart schedule matching



              </div>



            </div>





            {/* MATCH CARD */}



            <div className="match-card">



              <div className="match-header">



                <span>

                  CAMPUSPATH AI

                </span>



                <span className="match-score">

                  AI Powered

                </span>



              </div>





              <h3>

                Events that fit your path

              </h3>





              <p>

                Discover workshops, hackathons,

                seminars and campus activities

                selected for you.

              </p>





              <div className="match-points">



                <span>

                  ✓ Based on your interests

                </span>



                <span>

                  ✓ Based on your skills

                </span>



              </div>



            </div>



          </div>



        </div>





        {/* FOOTER */}



        <div className="auth-footer">



          Built for students, club leaders,

          inter-college organizers & university admins.



        </div>



      </section>





      {/* ======================================================

          RIGHT SIDE

          ====================================================== */}



      <section className="auth-right">



        <div className="auth-container">



          {/* ==================================================

              REGISTRATION FORM

              ================================================== */}



          {!otpSent ? (



            <>



              {/* HEADING */}



              <div className="auth-heading">



                <div>



                  <h2>

                    Create your account

                  </h2>



                  <p>

                    Join CampusPath AI and

                    discover opportunities.

                  </p>



                </div>



              </div>





              {/* ROLE */}



              <span className="role-label">

                I am registering as

              </span>





              <div className="role-grid">



                {roles.map((item) => (



                  <button

                    key={item.id}

                    type="button"

                    className={`role-button ${

                      role === item.id

                        ? "active"

                        : ""

                    }`}

                    onClick={() => {

                      setRole(item.id);

                      setError("");

                    }}

                  >



                    <span className="role-icon">

                      {item.icon}

                    </span>



                    {item.label}



                  </button>



                ))}



              </div>





              {/* FORM */}



              <form

                className="auth-form"

                onSubmit={handleRegister}

              >



                {/* NAME */}



                <div className="input-group">



                  <label>

                    Full name

                  </label>



                  <input

                    type="text"

                    placeholder="Enter your full name"

                    value={name}

                    onChange={(e) =>

                      setName(e.target.value)

                    }

                    required

                  />



                </div>





                {/* EMAIL */}



                <div className="input-group">



                  <label>

                    College email

                  </label>



                  <input

                    type="email"

                    placeholder="you\@college.edu"

                    value={email}

                    onChange={(e) =>

                      setEmail(e.target.value)

                    }

                    required

                  />



                </div>





                {/* DEPARTMENT */}



                <div className="input-group">



                  <label>

                    Department

                  </label>



                  <input

                    type="text"

                    placeholder="e.g. Artificial Intelligence"

                    value={department}

                    onChange={(e) =>

                      setDepartment(

                        e.target.value

                      )

                    }

                    required

                  />



                </div>





                {/* ==================================================

                    CLUB LEADER DETAILS

                    ONLY SHOWN FOR CLUB LEADER

                    ================================================== */}



                {role === "club" && (

                  <>



                    {/* STUDENT ID */}



                    <div className="input-group">



                      <label>

                        Student ID / University ID

                      </label>



                      <input

                        type="text"

                        placeholder="Enter your student ID"

                        value={studentId}

                        onChange={(e) =>

                          setStudentId(

                            e.target.value

                          )

                        }

                        required

                      />



                    </div>





                    {/* COLLEGE / UNIVERSITY */}



                    <div className="input-group">



                      <label>

                        College / University Name

                      </label>



                      <input

                        type="text"

                        placeholder="Enter your college or university"

                        value={collegeName}

                        onChange={(e) =>

                          setCollegeName(

                            e.target.value

                          )

                        }

                        required

                      />



                    </div>





                    {/* CLUB NAME */}



                    <div className="input-group">



                      <label>

                        Club Name

                      </label>



                      <input

                        type="text"

                        placeholder="e.g. AI & Robotics Club"

                        value={clubName}

                        onChange={(e) =>

                          setClubName(

                            e.target.value

                          )

                        }

                        required

                      />



                    </div>





                    {/* CLUB CATEGORY */}



                    <div className="input-group">



                      <label>

                        Club Category

                      </label>



                      <select

                        value={clubCategory}

                        onChange={(e) =>

                          setClubCategory(

                            e.target.value

                          )

                        }

                        required

                      >



                        <option value="">

                          Select club category

                        </option>



                        <option value="Technical">

                          Technical

                        </option>



                        <option value="Cultural">

                          Cultural

                        </option>



                        <option value="Sports">

                          Sports

                        </option>



                        <option value="Entrepreneurship">

                          Entrepreneurship

                        </option>



                        <option value="Social Service">

                          Social Service

                        </option>



                        <option value="Academic">

                          Academic

                        </option>



                        <option value="Other">

                          Other

                        </option>



                      </select>



                    </div>





                    {/* POSITION */}



                    <div className="input-group">



                      <label>

                        Your Position in the Club

                      </label>



                      <select

                        value={clubPosition}

                        onChange={(e) =>

                          setClubPosition(

                            e.target.value

                          )

                        }

                        required

                      >



                        <option value="">

                          Select your position

                        </option>



                        <option value="President">

                          President

                        </option>



                        <option value="Vice President">

                          Vice President

                        </option>



                        <option value="Secretary">

                          Secretary

                        </option>



                        <option value="Treasurer">

                          Treasurer

                        </option>



                        <option value="Event Coordinator">

                          Event Coordinator

                        </option>



                        <option value="Core Member">

                          Core Member

                        </option>



                        <option value="Other">

                          Other

                        </option>



                      </select>



                    </div>





                    {/* COORDINATOR NAME */}



                    <div className="input-group">



                      <label>

                        Faculty / Club Coordinator Name

                      </label>



                      <input

                        type="text"

                        placeholder="Enter coordinator name"

                        value={coordinatorName}

                        onChange={(e) =>

                          setCoordinatorName(

                            e.target.value

                          )

                        }

                        required

                      />



                    </div>





                    {/* COORDINATOR EMAIL */}



                    <div className="input-group">



                      <label>

                        Faculty / Coordinator Email

                      </label>



                      <input

                        type="email"

                        placeholder="coordinator\@college.edu"

                        value={coordinatorEmail}

                        onChange={(e) =>

                          setCoordinatorEmail(

                            e.target.value

                          )

                        }

                        required

                      />



                    </div>



                  </>

                )}





                {/* ======================================================

                    INTER-COLLEGE DETAILS

                    ONLY SHOWN WHEN INTER-COLLEGE IS SELECTED

                    ====================================================== */}



                {role === "intercollege" && (

                  <>



                    {/* COLLEGE / UNIVERSITY */}



                    <div className="input-group">



                      <label>

                        College / University Name

                      </label>



                      <input

                        type="text"

                        placeholder="Enter your college or university"

                        value={interCollegeName}

                        onChange={(e) =>

                          setInterCollegeName(e.target.value)

                        }

                        required

                      />



                    </div>





                    {/* ORGANIZATION / TEAM */}



                    <div className="input-group">



                      <label>

                        Organization / Team Name

                      </label>



                      <input

                        type="text"

                        placeholder="e.g. Cybersecurity Club"

                        value={interCollegeOrganization}

                        onChange={(e) =>

                          setInterCollegeOrganization(e.target.value)

                        }

                        required

                      />



                    </div>





                    {/* CLUB / ORGANIZATION CATEGORY */}



                    <div className="input-group">



                      <label>

                        Club / Organization Category

                      </label>



                      <select

                        value={interCollegeCategory}

                        onChange={(e) =>

                          setInterCollegeCategory(e.target.value)

                        }

                        required

                      >



                        <option value="">

                          Select club category

                        </option>



                        <option value="Technical">

                          Technical

                        </option>



                        <option value="Cultural">

                          Cultural

                        </option>



                        <option value="Sports">

                          Sports

                        </option>



                        <option value="Entrepreneurship">

                          Entrepreneurship

                        </option>



                        <option value="Social Service">

                          Social Service

                        </option>



                        <option value="Academic">

                          Academic

                        </option>



                        <option value="Other">

                          Other

                        </option>



                      </select>



                    </div>





                    {/* POSITION */}



                    <div className="input-group">



                      <label>

                        Your Position

                      </label>



                      <select

                        value={interCollegePosition}

                        onChange={(e) =>

                          setInterCollegePosition(e.target.value)

                        }

                        required

                      >



                        <option value="">

                          Select your position

                        </option>



                        <option value="President">

                          President

                        </option>



                        <option value="Vice President">

                          Vice President

                        </option>



                        <option value="Secretary">

                          Secretary

                        </option>



                        <option value="Treasurer">

                          Treasurer

                        </option>



                        <option value="Event Coordinator">

                          Event Coordinator

                        </option>



                        <option value="Core Member">

                          Core Member

                        </option>



                        <option value="Other">

                          Other

                        </option>



                      </select>



                    </div>





                    {/* COORDINATOR NAME */}



                    <div className="input-group">



                      <label>

                        Coordinator Name

                      </label>



                      <input

                        type="text"

                        placeholder="Enter coordinator name"

                        value={interCollegeCoordinatorName}

                        onChange={(e) =>

                          setInterCollegeCoordinatorName(e.target.value)

                        }

                        required

                      />



                    </div>





                    {/* COORDINATOR EMAIL */}



                    <div className="input-group">



                      <label>

                        Coordinator Email

                      </label>



                      <input

                        type="email"

                        placeholder="coordinator\@college.edu"

                        value={interCollegeCoordinatorEmail}

                        onChange={(e) =>

                          setInterCollegeCoordinatorEmail(e.target.value)

                        }

                        required

                      />



                    </div>



                  </>

                )}





                {/* PASSWORD */}



                <div className="input-group">



                  <label>

                    Password

                  </label>



                  <div className="password-wrapper">



                    <input

                      type={

                        showPassword

                          ? "text"

                          : "password"

                      }

                      placeholder="Create a password"

                      value={password}

                      onChange={(e) =>

                        setPassword(

                          e.target.value

                        )

                      }

                      required

                    />



                    <button

                      type="button"

                      className="password-toggle"

                      onClick={() =>

                        setShowPassword(

                          !showPassword

                        )

                      }

                    >



                      {showPassword

                        ? "Hide"

                        : "Show"}



                    </button>



                  </div>



                </div>





                {/* CONFIRM PASSWORD */}



                <div className="input-group">



                  <label>

                    Confirm password

                  </label>



                  <input

                    type="password"

                    placeholder="Confirm your password"

                    value={confirmPassword}

                    onChange={(e) =>

                      setConfirmPassword(

                        e.target.value

                      )

                    }

                    required

                  />



                </div>





                {/* ERROR */}



                {error && (



                  <div className="error-message">

                    {error}

                  </div>



                )}





                {/* SUCCESS MESSAGE */}



                {message && (



                  <div className="success-message">

                    {message}

                  </div>



                )}





                {/* SUBMIT */}



                <button

                  className="primary-button"

                  type="submit"

                  disabled={loading}

                >



                  {loading

                    ? "Sending OTP..."

                    : "Continue with verification"}



                </button>



              </form>





              {/* LOGIN */}



              <div className="auth-switch">



                Already have an account?



                <Link to="/login">

                  {" "}Log in

                </Link>



              </div>



            </>



          ) : (



            /* =================================================

               OTP VERIFICATION

               ================================================= */



            <div className="otp-container">



              <div className="otp-icon">

                ✉️

              </div>





              <h2>

                Verify your email

              </h2>





              <p>

                A 6-digit OTP has been sent to

              </p>





              <div className="otp-email">

                {email}

              </div>





              <p>

                Check your inbox and enter the 6-digit OTP

                below to verify your email.

              </p>





              <form

                onSubmit={

                  handleVerifyAndCreate

                }

              >



                <input

                  className="otp-input"

                  type="text"

                  inputMode="numeric"

                  maxLength="6"

                  placeholder="000000"

                  value={otp}

                  onChange={(e) =>

                    setOtp(

                      e.target.value.replace(

                        /\D/g,

                        ""

                      )

                    )

                  }

                  required

                />





                {/* ERROR */}



                {error && (



                  <div className="error-message">

                    {error}

                  </div>



                )}





                {/* MESSAGE */}



                {message && (



                  <div className="success-message">

                    {message}

                  </div>



                )}





                {/* VERIFY */}



                <button

                  className="primary-button"

                  type="submit"

                  disabled={

                    loading ||

                    otp.length !== 6

                  }

                >



                  {loading

                    ? "Creating account..."

                    : "Verify & Create Account"}



                </button>



              </form>





              {/* EDIT DETAILS */}



              <div className="otp-actions">



                <button

                  className="otp-secondary"

                  type="button"

                  onClick={() => {



                    setOtpSent(false);

                    setOtp("");

                    setError("");

                    setMessage("");



                  }}

                >



                  ← Edit details



                </button>



              </div>



            </div>



          )}



        </div>



      </section>



    </div>

  );

}



export default Register;