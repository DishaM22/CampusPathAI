import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./StudentOnboarding.css";

import TimetablePage from "../features/onboarding/timetable/TimetablePage";

const steps = [
  "Academic",
  "Interests",
  "Skills",
  "Goals",
  "Domains",
  "Timetable",
];

const interestOptions = [
  "Artificial Intelligence",
  "Machine Learning",
  "Web Development",
  "App Development",
  "Data Science",
  "Cyber Security",
  "Cloud Computing",
  "Internet of Things",
  "Robotics",
  "UI/UX Design",
];

const skillOptions = [
  "Python",
  "Java",
  "C",
  "C++",
  "JavaScript",
  "React",
  "Node.js",
  "SQL",
  "MongoDB",
  "TensorFlow",
  "PyTorch",
  "Git & GitHub",
];

const goalOptions = [
  "AI/ML Engineer",
  "Software Developer",
  "Data Scientist",
  "Web Developer",
  "App Developer",
  "Research",
  "Entrepreneurship",
  "Higher Studies",
  "Placement Preparation",
];

const domainOptions = [
  "Artificial Intelligence",
  "Machine Learning",
  "Software Engineering",
  "Data Science",
  "Web Technologies",
  "Mobile Development",
  "Cyber Security",
  "Cloud Computing",
  "IoT",
  "Research & Innovation",
];

function StudentOnboarding() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);

  const [profile, setProfile] = useState({
    year: "",
    semester: "",
    department: "",
    interests: [],
    skills: [],
    goals: [],
    domains: [],
  });

  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleSelection = (field, value) => {
    setProfile((prev) => {
      const currentValues = prev[field];

      if (currentValues.includes(value)) {
        return {
          ...prev,
          [field]: currentValues.filter(
            (item) => item !== value
          ),
        };
      }

      return {
        ...prev,
        [field]: [...currentValues, value],
      };
    });
  };

  // ============================================================
  // MOVE TO NEXT PROFILE STEP
  // ============================================================

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  // ============================================================
  // MOVE BACK
  // ============================================================

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // ============================================================
  // SAVE PROFILE - STEPS 1 TO 5
  // ============================================================

  const finishSteps = async () => {
  try {
    setSaving(true);

    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Authentication token not found. Please login again."
      );
    }

    // Convert frontend field names to backend field names
    const profileToSave = {
      year: profile.year,

      interests: profile.interests || [],

      skills: profile.skills || [],

      // Backend expects career_goal
      // Your UI stores goals as an array
      career_goal:
        profile.goals && profile.goals.length > 0
          ? profile.goals.join(", ")
          : "",

      // Backend expects preferred_domains
      preferred_domains: profile.domains || [],
    };

    console.log("Saving profile:", profileToSave);

    const response = await fetch(
      "http://127.0.0.1:8000/api/profile",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(profileToSave),
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    console.log("PROFILE SAVE STATUS:", response.status);
    console.log("PROFILE SAVE RESPONSE:", data);

    if (!response.ok) {
      let errorMessage = "Failed to save profile.";

      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((error) => {
            if (typeof error === "string") {
              return error;
            }

            return (
              error.msg ||
              error.message ||
              JSON.stringify(error)
            );
          })
          .join("\n");
      } else if (typeof data.detail === "string") {
        errorMessage = data.detail;
      } else if (typeof data.message === "string") {
        errorMessage = data.message;
      }

      throw new Error(errorMessage);
    }

    console.log("Student profile saved successfully.");

    // Keep a local backup
    localStorage.setItem(
      "campusPathOnboarding",
      JSON.stringify(profile)
    );

    // IMPORTANT:
    // Do not mark onboarding complete yet.
    // Timetable is Step 6.

    setCurrentStep(6);
  } catch (error) {
    console.error("Profile save error:", error);

    alert(error.message || "Failed to save profile.");

  } finally {
    setSaving(false);
  }
};

  // ============================================================
  // TIMETABLE COMPLETED
  // ============================================================

  const handleTimetableContinue = async (timetableData) => {
    console.log(
        "TIMETABLE SAVED:",
        timetableData
    );

    try {
        const token = localStorage.getItem("token");

        if (!token) {
            alert("Authentication token not found. Please login again.");
            return;
        }

        // Save timetable to backend / MongoDB
        const response = await fetch(
            "http://127.0.0.1:8000/api/student/timetable",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },

                body: JSON.stringify({
                    timetable:
                        timetableData?.timetable || timetableData || {},

                    config:
                        timetableData?.config || {},

                    preferences:
                        timetableData?.preferences || {},
                }),
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        console.log(
            "TIMETABLE SAVE STATUS:",
            response.status
        );

        console.log(
            "TIMETABLE SAVE RESPONSE:",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.detail ||
                data.message ||
                "Failed to save timetable."
            );
        }

        console.log(
            "Timetable saved successfully to MongoDB."
        );

        // Keep local backup
        if (timetableData) {
            localStorage.setItem(
                "campusPathTimetable",
                JSON.stringify(timetableData)
            );
        }

        // ==========================================
        // ONBOARDING IS NOW FULLY COMPLETED
        // Steps 1–5 + Step 6 Timetable
        // ==========================================

        const studentEmail = (
            localStorage.getItem("userEmail") || ""
        )
            .trim()
            .toLowerCase();

        if (studentEmail) {
            localStorage.setItem(
                `onboardingCompleted_${studentEmail}`,
                "true"
            );
        }

        // Keep old flag for compatibility
        localStorage.setItem(
            "profileCompleted",
            "true"
        );

        // Go to student dashboard
        navigate("/dashboard");

    } catch (error) {
        console.error(
            "TIMETABLE SAVE ERROR:",
            error
        );

        alert(
            error.message ||
            "Failed to save timetable. Please try again."
        );
    }
};

   
  // ============================================================
  // STEP 6 - TIMETABLE
  //
  // This is returned separately so that the timetable page
  // does not get the old onboarding header/navigation around it.
  // ============================================================

  if (currentStep === 6) {
    return (
      <TimetablePage
        onBack={() => setCurrentStep(5)}
        onContinue={handleTimetableContinue}
      />
    );
  }

  // ============================================================
  // NORMAL ONBOARDING UI - STEPS 1 TO 5
  // ============================================================

  return (
    <div className="onboarding-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="onboarding-header">

        <div className="brand">

          <div className="brand-logo">
            CP
          </div>

          <div className="brand-name">
            <span>
              CampusPath
            </span>

            <small>
              AI
            </small>
          </div>

        </div>

        <button
          className="theme-button"
          type="button"
        >
          ☾
        </button>

      </header>


      {/* ======================================================
          PROGRESS
      ====================================================== */}

      <div className="progress-container">

        <div className="progress-line">

          <div
            className="progress-filled"
            style={{
              width: `${((currentStep - 1) / 5) * 100}%`,
            }}
          />

        </div>


        <div className="steps-container">

          {steps.map((step, index) => {

            const stepNumber = index + 1;

            const completed =
              stepNumber < currentStep;

            const active =
              stepNumber === currentStep;

            return (
              <div
                className={`step-item ${
                  active ? "active" : ""
                } ${
                  completed ? "completed" : ""
                }`}
                key={step}
              >

                <div className="step-circle">

                  {completed
                    ? "✓"
                    : `0${stepNumber}`}

                </div>

                <span>
                  {step}
                </span>

              </div>
            );

          })}

        </div>

      </div>


      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="onboarding-content">

        {/* ====================================================
            STEP 1 - ACADEMIC
        ==================================================== */}

        {currentStep === 1 && (
          <AcademicStep
            profile={profile}
            updateField={updateField}
          />
        )}


        {/* ====================================================
            STEP 2 - INTERESTS
        ==================================================== */}

        {currentStep === 2 && (
          <InterestsStep
            profile={profile}
            toggleSelection={toggleSelection}
          />
        )}


        {/* ====================================================
            STEP 3 - SKILLS
        ==================================================== */}

        {currentStep === 3 && (
          <SkillsStep
            profile={profile}
            toggleSelection={toggleSelection}
          />
        )}


        {/* ====================================================
            STEP 4 - GOALS
        ==================================================== */}

        {currentStep === 4 && (
          <GoalsStep
            profile={profile}
            toggleSelection={toggleSelection}
          />
        )}


        {/* ====================================================
            STEP 5 - DOMAINS
        ==================================================== */}

        {currentStep === 5 && (
          <DomainsStep
            profile={profile}
            toggleSelection={toggleSelection}
          />
        )}

      </main>


      {/* ======================================================
          BOTTOM NAVIGATION
      ====================================================== */}

      <div className="onboarding-navigation">

        {/* BACK BUTTON */}

        {currentStep > 1 ? (

          <button
            className="back-button"
            type="button"
            onClick={previousStep}
          >
            ← Back
          </button>

        ) : (

          <div />

        )}


        {/* CONTINUE BUTTON */}

        {currentStep < 5 ? (

          <button
            className="continue-button"
            type="button"
            onClick={nextStep}
          >
            Continue →
          </button>

        ) : (

          <button
            className="continue-button"
            type="button"
            onClick={finishSteps}
            disabled={saving}
          >

            {saving
              ? "Saving..."
              : "Continue →"}

          </button>

        )}

      </div>

    </div>
  );
}


/* =============================================================
   STEP 1 - ACADEMIC
============================================================= */

function AcademicStep({
  profile,
  updateField,
}) {
  return (
    <section className="step-content">

      <div className="step-label">
        STEP 1 OF 6
      </div>

      <h1>
        Tell us about your academics
      </h1>

      <p className="step-description">
        This helps CampusPath AI understand your academic
        background and recommend relevant opportunities.
      </p>


      {/* CURRENT YEAR */}

      <div className="form-section">

        <label>
          Current Year
        </label>

        <div className="option-grid">

          {[
            "1st Year",
            "2nd Year",
            "3rd Year",
            "4th Year",
          ].map((year) => (

            <button
              key={year}
              type="button"
              className={`option-card ${
                profile.year === year
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                updateField(
                  "year",
                  year
                )
              }
            >
              {year}
            </button>

          ))}

        </div>

      </div>


      {/* CURRENT SEMESTER */}

      <div className="form-section">

        <label>
          Current Semester
        </label>

        <select
          value={profile.semester}
          onChange={(e) =>
            updateField(
              "semester",
              e.target.value
            )
          }
        >

          <option value="">
            Select semester
          </option>

          {[
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
          ].map((semester) => (

            <option
              key={semester}
              value={semester}
            >
              Semester {semester}
            </option>

          ))}

        </select>

      </div>


      {/* DEPARTMENT */}

      <div className="form-section">

        <label>
          Department
        </label>

        <select
          value={profile.department}
          onChange={(e) =>
            updateField(
              "department",
              e.target.value
            )
          }
        >

          <option value="">
            Select your department
          </option>

          <option>
            Artificial Intelligence
          </option>

          <option>
            Computer Science & Engineering
          </option>

          <option>
            Information Science
          </option>

          <option>
            Electronics & Communication
          </option>

          <option>
            Electrical & Electronics
          </option>

          <option>
            Mechanical Engineering
          </option>

          <option>
            Civil Engineering
          </option>

          <option>
            Other
          </option>

        </select>

      </div>

    </section>
  );
}


/* =============================================================
   STEP 2 - INTERESTS
============================================================= */

function InterestsStep({
  profile,
  toggleSelection,
}) {
  return (
    <section className="step-content">

      <div className="step-label">
        STEP 2 OF 6
      </div>

      <h1>
        What are you interested in?
      </h1>

      <p className="step-description">
        Select the areas you enjoy or want to explore.
        CampusPath AI will use these interests to
        personalize your event recommendations.
      </p>


      <div className="selection-grid">

        {interestOptions.map(
          (interest) => {

            const selected =
              profile.interests.includes(
                interest
              );

            return (
              <button
                key={interest}
                type="button"
                className={`selection-card ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(
                    "interests",
                    interest
                  )
                }
              >

                <span>
                  {selected
                    ? "✓"
                    : "+"}
                </span>

                {interest}

              </button>
            );

          }
        )}

      </div>


      <div className="info-box">

        <div className="info-icon">
          AI
        </div>

        <p>
          Select multiple interests.
          These will become important
          features for your personalized
          recommendation profile.
        </p>

      </div>

    </section>
  );
}


/* =============================================================
   STEP 3 - SKILLS
============================================================= */

function SkillsStep({
  profile,
  toggleSelection,
}) {
  return (
    <section className="step-content">

      <div className="step-label">
        STEP 3 OF 6
      </div>

      <h1>
        What skills do you have?
      </h1>

      <p className="step-description">
        Tell us about your technical and professional
        skills so we can identify events that match
        your current abilities and help you grow.
      </p>


      <div className="selection-grid">

        {skillOptions.map(
          (skill) => {

            const selected =
              profile.skills.includes(
                skill
              );

            return (
              <button
                key={skill}
                type="button"
                className={`selection-card ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(
                    "skills",
                    skill
                  )
                }
              >

                <span>
                  {selected
                    ? "✓"
                    : "+"}
                </span>

                {skill}

              </button>
            );

          }
        )}

      </div>


      <div className="info-box">

        <div className="info-icon">
          AI
        </div>

        <p>
          Your skills can be compared
          with the skills required by
          campus events.
        </p>

      </div>

    </section>
  );
}


/* =============================================================
   STEP 4 - CAREER GOALS
============================================================= */

function GoalsStep({
  profile,
  toggleSelection,
}) {
  return (
    <section className="step-content">

      <div className="step-label">
        STEP 4 OF 6
      </div>

      <h1>
        What are your career goals?
      </h1>

      <p className="step-description">
        Your career goals help CampusPath AI understand
        where you want to go and recommend opportunities
        that support that direction.
      </p>


      <div className="selection-grid">

        {goalOptions.map(
          (goal) => {

            const selected =
              profile.goals.includes(
                goal
              );

            return (
              <button
                key={goal}
                type="button"
                className={`selection-card ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(
                    "goals",
                    goal
                  )
                }
              >

                <span>
                  {selected
                    ? "✓"
                    : "+"}
                </span>

                {goal}

              </button>
            );

          }
        )}

      </div>


      <div className="info-box">

        <div className="info-icon">
          AI
        </div>

        <p>
          Your career goals will be used
          as one of the signals for
          personalized event ranking.
        </p>

      </div>

    </section>
  );
}


/* =============================================================
   STEP 5 - DOMAINS
============================================================= */

function DomainsStep({
  profile,
  toggleSelection,
}) {
  return (
    <section className="step-content">

      <div className="step-label">
        STEP 5 OF 6
      </div>

      <h1>
        Which domains do you want to explore?
      </h1>

      <p className="step-description">
        Choose the technical or professional domains
        you want CampusPath AI to focus on when
        finding relevant opportunities.
      </p>


      <div className="selection-grid">

        {domainOptions.map(
          (domain) => {

            const selected =
              profile.domains.includes(
                domain
              );

            return (
              <button
                key={domain}
                type="button"
                className={`selection-card ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  toggleSelection(
                    "domains",
                    domain
                  )
                }
              >

                <span>
                  {selected
                    ? "✓"
                    : "+"}
                </span>

                {domain}

              </button>
            );

          }
        )}

      </div>


      <div className="info-box">

        <div className="info-icon">
          AI
        </div>

        <p>
          Great! Your profile is almost ready.
          Next, we will collect your timetable
          so CampusPath AI can recommend events
          during your available periods.
        </p>

      </div>

    </section>
  );
}


export default StudentOnboarding;