import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function StudentDashboard() {

  const navigate = useNavigate();

  const [student, setStudent] = useState(null);

  const [recommendedEvents, setRecommendedEvents] = useState([]);

  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const [loading, setLoading] = useState(true);


  useEffect(() => {

    const token = localStorage.getItem("token");

    const studentData =
      localStorage.getItem("student");


    if (!token || !studentData) {

      navigate("/login");

      return;

    }


    setStudent(
      JSON.parse(studentData)
    );


    fetch(
      "http://127.0.0.1:8000/api/dashboard/events",
      {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    )

      .then(response => {

        if (!response.ok) {

          throw new Error(
            "Failed to load dashboard"
          );

        }

        return response.json();

      })

      .then(data => {

        setRecommendedEvents(
          data.recommended || []
        );

        setUpcomingEvents(
          data.upcoming || []
        );

        setLoading(false);

      })

      .catch(error => {

        console.error(error);

        setLoading(false);

      });

  }, [navigate]);


  const handleLogout = () => {

    localStorage.removeItem("token");

    localStorage.removeItem("student");

    navigate("/login");

  };


  if (!student) {

    return (
      <p>Loading...</p>
    );

  }


  return (

    <div style={{
      padding: "40px"
    }}>

      {/* HEADER */}

      <h1>
        Welcome, {student.name}! 👋
      </h1>

      <p>
        Discover opportunities selected
        for your goals and interests.
      </p>


      {/* STUDENT INFORMATION */}

      <div>

        <h2>
          Student Information
        </h2>

        <p>
          <strong>Name:</strong>{" "}
          {student.name}
        </p>

        <p>
          <strong>Department:</strong>{" "}
          {student.department}
        </p>

      </div>


      <hr />


      {/* RECOMMENDED EVENTS */}

      <h2>
        ⭐ Recommended For You
      </h2>

      <p>
        Events matched with your interests,
        skills and career goals.
      </p>


      {loading ? (

        <p>
          Finding opportunities for you...
        </p>

      ) : recommendedEvents.length === 0 ? (

        <p>
          Complete your profile to receive
          personalized recommendations.
        </p>

      ) : (

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px"
        }}>

          {recommendedEvents.map(event => (

            <div
              key={event._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "15px",
                padding: "20px"
              }}
            >

              <h3>
                {event.title}
              </h3>

              <p>
                {event.description}
              </p>

              <p>
                📅 {event.date}
              </p>

              <p>
                🕐 {event.time}
              </p>

              <p>
                📍 {event.location}
              </p>

              <p>
                <strong>
                  Skills:
                </strong>{" "}
                {event.skills.join(", ")}
              </p>


              <button
                onClick={() =>
                  navigate(
                    `/events/${event._id}`
                  )
                }
              >
                View Details
              </button>

            </div>

          ))}

        </div>

      )}


      {/* UPCOMING EVENTS */}

      <h2 style={{
        marginTop: "40px"
      }}>
        📅 Upcoming Campus Events
      </h2>


      {upcomingEvents.length === 0 ? (

        <p>
          No upcoming events available.
        </p>

      ) : (

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px"
        }}>

          {upcomingEvents.map(event => (

            <div
              key={event._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "15px",
                padding: "20px"
              }}
            >

              <h3>
                {event.title}
              </h3>

              <p>
                {event.description}
              </p>

              <p>
                📅 {event.date}
              </p>

              <p>
                📍 {event.location}
              </p>


              <button
                onClick={() =>
                  navigate(
                    `/events/${event._id}`
                  )
                }
              >
                View Details
              </button>

            </div>

          ))}

        </div>

      )}


      <br />

      <button
        onClick={() =>
          navigate("/profile")
        }
      >
        Update Profile
      </button>


      <button
        onClick={handleLogout}
        style={{
          marginLeft: "10px"
        }}
      >
        Logout
      </button>

    </div>

  );

}

export default StudentDashboard;