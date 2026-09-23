import { useState } from "react";
import { useNavigate } from "react-router-dom";

function StudentProfile() {

  const navigate = useNavigate();

  const [year, setYear] = useState("");

  const [interests, setInterests] = useState("");

  const [skills, setSkills] = useState("");

  const [careerGoal, setCareerGoal] = useState("");

  const [domains, setDomains] = useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e) => {

    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {

      navigate("/login");

      return;

    }


    setLoading(true);

    setMessage("");


    const profileData = {

      year: year,

      interests: interests
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== ""),

      skills: skills
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== ""),

      career_goal: careerGoal,

      preferred_domains: domains
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== "")

    };


    try {

      const response = await fetch(
        "http://127.0.0.1:8000/api/profile",
        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

            "Authorization": `Bearer ${token}`

          },

          body: JSON.stringify(profileData)

        }
      );


      const data = await response.json();


      if (response.ok) {

        setMessage(
          "Profile saved successfully!"
        );

        setTimeout(() => {
    navigate("/events");
}, 1000);

      } else {

        setMessage(
          data.detail || "Failed to save profile"
        );

      }

    } catch (error) {

      console.error(error);

      setMessage(
        "Unable to connect to the server."
      );

    } finally {

      setLoading(false);

    }

  };


  return (

    <div className="auth-container">

      <div className="auth-card">

        <h1>Complete Your Profile</h1>

        <p>
          Help CampusPath AI understand your goals.
        </p>


        <form onSubmit={handleSubmit}>

          <select
            value={year}
            onChange={(e) =>
              setYear(e.target.value)
            }
            required
          >

            <option value="">
              Select Academic Year
            </option>

            <option>1st Year</option>
            <option>2nd Year</option>
            <option>3rd Year</option>
            <option>4th Year</option>

          </select>


          <input
            type="text"
            placeholder="Interests (e.g. AI, Web Development, Robotics)"
            value={interests}
            onChange={(e) =>
              setInterests(e.target.value)
            }
            required
          />


          <input
            type="text"
            placeholder="Current Skills (e.g. Python, Java, SQL)"
            value={skills}
            onChange={(e) =>
              setSkills(e.target.value)
            }
            required
          />


          <input
            type="text"
            placeholder="Career Goal (e.g. AI/ML Engineer)"
            value={careerGoal}
            onChange={(e) =>
              setCareerGoal(e.target.value)
            }
            required
          />


          <input
            type="text"
            placeholder="Preferred Domains (e.g. AI, Data Science)"
            value={domains}
            onChange={(e) =>
              setDomains(e.target.value)
            }
            required
          />


          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Saving..."
              : "Save Profile"}

          </button>

        </form>


        {message && (
          <p>{message}</p>
        )}

      </div>

    </div>

  );
}

export default StudentProfile;