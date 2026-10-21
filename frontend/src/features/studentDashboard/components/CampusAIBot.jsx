
import { useState, useRef, useEffect } from "react";
import "./CampusAIBot.css";

const API_BASE = "http://127.0.0.1:8000";

export default function CampusAIBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm CampusPath AI. I can help you discover campus events, understand recommendations, and plan around your timetable."
    }
  ]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (event) => {
    event.preventDefault();

    const text = message.trim();
    if (!text || sending) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please log in again to use CampusPath AI."
        }
      ]);
      return;
    }

    const history = messages
      .filter((item) => ["user", "assistant"].includes(item.role))
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");
    setSending(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          history
        })
      });

      const rawResponse = await response.text();
      let data;

      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "The AI assistant couldn't respond.";

        throw new Error(detail);
      }

      const answer =
        typeof data.answer === "string" ? data.answer.trim() : "";

      if (!answer) {
        throw new Error(
          "The AI returned an empty answer. Please try again."
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't get a response from CampusPath AI. ${
            error.message || "Please try again."
          }`
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="campus-ai-widget">
      {isOpen && (
        <section
          className="campus-ai-panel"
          aria-label="CampusPath AI chat"
        >
          <header className="campus-ai-header">
            <div className="campus-ai-brand">
              <div className="campus-ai-avatar">
                <span>✦</span>
                <span className="campus-ai-mini-bot">●</span>
              </div>

              <div>
                <h3>CampusPath AI</h3>
                <p>
                  <span className="campus-ai-online-dot" />
                  Your campus assistant
                </p>
              </div>
            </div>

            <div className="campus-ai-header-actions">
              <button
                type="button"
                aria-label="Minimize chat"
                onClick={() => setIsOpen(false)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div className="campus-ai-messages" aria-live="polite">
            {messages.map((item, index) => (
              <div
                key={`${index}-${item.role}`}
                className={`campus-ai-message ${
                  item.role === "user" ? "user-message" : "bot-message"
                }`}
              >
                {item.content}
              </div>
            ))}

            {sending && (
              <div className="campus-ai-message bot-message">
                Thinking...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="campus-ai-suggestions">
            <button
              type="button"
              disabled={sending}
              onClick={() =>
                setMessage("Recommend campus events based on my interests.")
              }
            >
              Recommend events
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() =>
                setMessage("Help me find events that fit my timetable.")
              }
            >
              Check my schedule
            </button>
          </div>

          <form className="campus-ai-input-area" onSubmit={sendMessage}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask CampusPath AI..."
              aria-label="Message CampusPath AI"
              maxLength={2000}
              disabled={sending}
            />

            <button
              type="submit"
              aria-label="Send message"
              disabled={sending || !message.trim()}
            >
              ➤
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`campus-ai-fab ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close CampusPath AI" : "Open CampusPath AI"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <span className="campus-ai-close-icon">×</span>
        ) : (
          <span className="campus-ai-bot-icon">
            <svg
              viewBox="0 0 48 48"
              width="36"
              height="36"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M24 5v6"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="24" cy="4" r="3" fill="#8DE7FF" />
              <rect
                x="7"
                y="12"
                width="34"
                height="27"
                rx="10"
                fill="white"
              />
              <rect
                x="12"
                y="18"
                width="24"
                height="13"
                rx="5"
                fill="#6557F5"
              />
              <circle cx="18" cy="24.5" r="2.3" fill="white" />
              <circle cx="30" cy="24.5" r="2.3" fill="white" />
              <path
                d="M18 35h12"
                stroke="#6557F5"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M7 22H4v10h4M41 22h3v10h-4"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
        {!isOpen && <span className="campus-ai-fab-label">AI</span>}
      </button>
    </div>
  );
}
