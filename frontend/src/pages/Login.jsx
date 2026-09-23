import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    setMessage("");


    try {

      const response = await fetch(
        "http://127.0.0.1:8000/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email: email,
            password: password
          })
        }
      );


      const data = await response.json();


      if (data.status === "success") {

        // Save JWT token
        localStorage.setItem(
          "token",
          data.token
        );


        // Save student information
        localStorage.setItem(
          "student",
          JSON.stringify({
            id: data.student_id,
            name: data.name,
            email: email,
            department: data.department
          })
        );


        setMessage("Login successful!");

        setTimeout(() => {

          navigate("/dashboard");

        }, 500);

      } else {

        setMessage(data.message);

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

        <h1>Welcome Back</h1>

        <p>
          Login to CampusPath AI
        </p>


        <form onSubmit={handleSubmit}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />


          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />


          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Logging in..."
              : "Login"}

          </button>

        </form>


        {message && (

          <p>
            {message}
          </p>

        )}


        <p>

          Don't have an account?{" "}

          <Link to="/register">
            Create Account
          </Link>

        </p>

      </div>

    </div>

  );

}

export default Login;