import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

function EventDetails() {

  const { id } = useParams();

  const navigate = useNavigate();

  const [event, setEvent] = useState(null);

  const [loading, setLoading] = useState(true);


  useEffect(() => {

    fetch(
      `http://127.0.0.1:8000/api/events/${id}`
    )

      .then(response => response.json())

      .then(data => {

        setEvent(data);

        setLoading(false);

      })

      .catch(error => {

        console.error(error);

        setLoading(false);

      });

  }, [id]);


  if (loading) {

    return (
      <p>Loading event...</p>
    );

  }


  if (!event) {

    return (
      <p>Event not found.</p>
    );

  }


  return (

    <div style={{
      padding: "40px",
      maxWidth: "800px",
      margin: "auto"
    }}>

      <button
        onClick={() =>
          navigate("/dashboard")
        }
      >
        ← Back to Dashboard
      </button>


      <h1>
        {event.title}
      </h1>


      <p>
        {event.description}
      </p>


      <hr />


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
        Register for Event
      </button>

    </div>

  );

}

export default EventDetails;