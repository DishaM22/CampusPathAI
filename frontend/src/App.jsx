import { BrowserRouter, Routes, Route } from "react-router-dom";

import StudentDashboard from "./pages/StudentDashboard";
import Register from "./pages/Register";
import Login from "./pages/Login";
import StudentProfile from "./pages/StudentProfile";
import EventManagement from "./pages/EventManagement";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";

function Home() {
  return (
    <div style={{ padding: "50px", textAlign: "center" }}>

      <h1>CampusPath AI</h1>

      <p>
        AI & ML-Based Personalized Campus Opportunity Platform
      </p>

      <br />

      <a href="/login">
        <button>
          Login
        </button>
      </a>

      <a href="/register">
        <button style={{ marginLeft: "10px" }}>
          Register
        </button>
      </a>

    </div>
  );
}


function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/dashboard"
          element={<StudentDashboard />}
        />

        <Route
          path="/profile"
          element={<StudentProfile />}
        />

        {/* Student Events Page */}
        <Route
          path="/events"
          element={<Events />}
        />

        {/* Organizer Event Management */}
        <Route
          path="/events/manage"
          element={<EventManagement />}
        />

        <Route
          path="/events/:id"
          element={<EventDetails />}
        />
      </Routes>

    </BrowserRouter>

  );
}


export default App;