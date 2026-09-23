import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Events() {

  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {

    fetch("http://127.0.0.1:8000/api/events")
      .then((response) => response.json())
      .then((data) => {

        setEvents(data);
        setLoading(false);

      })
      .catch((error) => {

        console.error("Error loading events:", error);
        setLoading(false);

      });

  }, []);


  if (loading) {

    return (
      <div style={{ padding: "40px" }}>
        <h2>Loading campus events...</h2>
      </div>
    );

  }


  return (

    <div style={{ padding: "40px" }}>

      <button
        onClick={() => navigate("/dashboard")}
      >
        ← Back to Dashboard
      </button>


      <h1>Campus Events</h1>

      <p>
        Discover opportunities happening on campus.
      </p>


      {events.length === 0 ? (

        <p>
          No events available.
        </p>

      ) : (

        <div>

          {events.map((event) => (

            <div
              key={event._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "20px",
                marginTop: "20px"
              }}
            >

              <h2>
                {event.title}
              </h2>


              <p>
                {event.description}
              </p>


              <p>
                <strong>Category:</strong>{" "}
                {event.category}
              </p>


              <p>
                <strong>Organizer:</strong>{" "}
                {event.organizer}
              </p>


              <p>
                <strong>Date:</strong>{" "}
                {event.date}
              </p>


              <p>
                <strong>Time:</strong>{" "}
                {event.time}
              </p>


              <p>
                <strong>Location:</strong>{" "}
                {event.location}
              </p>


              <p>
                <strong>Skills:</strong>{" "}
                {event.skills.join(", ")}
              </p>


              <button>
                View Event
              </button>

            </div>

          ))}

        </div>

      )}

    </div>

  );
}

export default Events;