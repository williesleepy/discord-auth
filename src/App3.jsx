import { useEffect, useState } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

// ------------------------
// App
// ------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ------------------------
  // Initial Load
  // ------------------------
  useEffect(() => {
    const tokenFromUrl = getTokenFromUrl();

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);

      // remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    load();
  }, []);

  // ------------------------
  // Load Messages + User
  // ------------------------
  async function load() {
    const token = getToken();

    if (!token) return;

    try {
      // user
      const userRes = await fetch(`${API}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!userRes.ok) {
        throw new Error("Auth failed");
      }

      const userData = await userRes.json();
      setUser(userData);

      // messages
      const msgRes = await fetch(`${API}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!msgRes.ok) {
        throw new Error("Message fetch failed");
      }

      const msgData = await msgRes.json();
      setMessages(msgData);
    } catch (err) {
      console.error(err);
      setUser(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------
  // Login
  // ------------------------
  const login = () => {
    window.location.href = `${API}/login`;
  };

  // ------------------------
  // Send Message
  // ------------------------
  const sendMessage = async () => {
    const token = getToken();

    if (!token) return;

    if (!input.trim() && !file) return;

    try {
      const formData = new FormData();

      formData.append("message", input);

      if (file) {
        formData.append("file", file);
      }

      await fetch(`${API}/send`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "POST",
        body: formData,
      });

      setInput("");
      setFile(null);

      // refresh messages
      await load();
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // ------------------------
  // UI
  // ------------------------
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <button onClick={login}>Login with Discord</button>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome {user.username}</h2>

      {/* Send UI */}
      <div style={{ marginTop: 20 }}>
        <input
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message"
          value={input}
        />

        <input onChange={(e) => setFile(e.target.files[0])} type="file" />

        <button onClick={sendMessage}>Send</button>
      </div>

      {/* Messages */}
      <div style={{ marginTop: 30 }}>
        <h3>Messages</h3>

        {messages.map((msg) => (
          <div
            style={{
              border: "1px solid #ccc",
              marginBottom: 12,
              borderRadius: 8,
              padding: 12,
            }}
            key={msg.id}
          >
            {/* Username */}
            <div
              style={{
                fontWeight: "bold",
                marginBottom: 6,
              }}
            >
              {msg.author?.username}
            </div>

            {/* Text */}
            {msg.content && (
              <div style={{ marginBottom: 10 }}>{msg.content}</div>
            )}

            {/* Attachments */}
            {msg.attachments?.map((att) => {
              const isImage = att.content_type?.startsWith("image/");

              // image
              if (isImage) {
                return (
                  <img
                    style={{
                      display: "block",
                      borderRadius: 8,
                      maxWidth: 300,
                      marginTop: 10,
                    }}
                    src={att.url}
                    key={att.id}
                    alt=""
                  />
                );
              }

              // non-image file
              return (
                <div style={{ marginTop: 10 }} key={att.id}>
                  <a rel="noreferrer" target="_blank" href={att.url}>
                    {att.filename}
                  </a>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getToken() {
  const token = localStorage.getItem("token");

  if (!token || token === "null" || token === "undefined") {
    return null;
  }

  return token;
}

// ------------------------
// Helpers
// ------------------------
function getTokenFromUrl() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace("#", ""));
  return params.get("token");
}
