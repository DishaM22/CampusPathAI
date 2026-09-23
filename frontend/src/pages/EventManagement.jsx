import { useState } from "react";

function EventManagement() {

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    organizer: "",
    date: "",
    time: "",
    location: "",
    skills: ""
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);


  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });

  };


  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);
    setMessage("");


    const eventData = {

      title: formData.title,

      description: formData.description,

      category: formData.category,

      organizer: formData.organizer,

      date: formData.date,

      time: formData.time,

      location: formData.location,

      skills: formData.skills
        .split(",")
        .map(skill => skill.trim())
        .filter(skill => skill !== "")

    };


    try {

      const response = await fetch(
        "http://127.0.0.1:8000/api/events",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(eventData)
        }
      );


      const data = await response.json();


      if (response.ok) {

        setMessage(
          "Event created successfully!"
        );


        setFormData({
          title: "",
          description: "",
          category: "",
          organizer: "",
          date: "",
          time: "",
          location: "",
          skills: ""
        });

      } else {

        setMessage(
          data.detail || "Failed to create event"
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

        <h1>Create Campus Event</h1>

        <p>
          Add a new opportunity for students.
        </p>


        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="title"
            placeholder="Event Title"
            value={formData.title}
            onChange={handleChange}
            required
          />


          <textarea
            name="description"
            placeholder="Event Description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            required
          />


          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >

            <option value="">
              Select Category
            </option>

            <option>Technical</option>
            <option>Workshop</option>
            <option>Hackathon</option>
            <option>Seminar</option>
            <option>Sports</option>
            <option>Cultural</option>
            <option>Career</option>
            <option>Other</option>

          </select>


          <input
            type="text"
            name="organizer"
            placeholder="Organizer / Club"
            value={formData.organizer}
            onChange={handleChange}
            required
          />


          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />


          <input
            type="text"
            name="time"
            placeholder="Time (e.g. 10:00 AM)"
            value={formData.time}
            onChange={handleChange}
            required
          />


          <input
            type="text"
            name="location"
            placeholder="Location"
            value={formData.location}
            onChange={handleChange}
            required
          />


          <input
            type="text"
            name="skills"
            placeholder="Skills (e.g. Python, AI, ML)"
            value={formData.skills}
            onChange={handleChange}
            required
          />


          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Creating..."
              : "Create Event"}

          </button>

        </form>


        {message && (
          <p>{message}</p>
        )}

      </div>

    </div>

  );
}

export default EventManagement;