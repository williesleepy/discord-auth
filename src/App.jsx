import { useEffect, useState, useMemo } from "react";

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

  // chat | gallery
  const [tab, setTab] = useState("chat");

  // ------------------------
  // Initial Load
  // ------------------------
  useEffect(() => {
    const tokenFromUrl = getTokenFromUrl();

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);

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
  // Load
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

      // Discord already returns newest -> oldest
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
  // Send
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

      await load();
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // ------------------------
  // Gallery Images
  // ------------------------
  const images = useMemo(() => {
    return messages.flatMap((msg) =>
      (msg.attachments || [])
        .filter((att) => att.content_type?.startsWith("image/"))
        .map((att) => ({
          author: msg.author?.username,
          timestamp: msg.timestamp,
          filename: att.filename,
          content: msg.content,
          url: att.url,
          id: att.id,
        })),
    );
  }, [messages]);

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

      {/* Tabs */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          marginTop: 20,
          gap: 10,
        }}
      >
        <button onClick={() => setTab("chat")}>Chat</button>

        <button onClick={() => setTab("gallery")}>Gallery</button>
      </div>

      {/* CHAT TAB */}
      {tab === "chat" && (
        <>
          {/* Send UI */}
          <div style={{ marginBottom: 30 }}>
            <input
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message"
              value={input}
            />

            <input onChange={(e) => setFile(e.target.files[0])} type="file" />

            <button onClick={sendMessage}>Send</button>
          </div>

          {/* Messages */}
          <div>
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

                {/* Timestamp */}
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  {new Date(msg.timestamp).toLocaleString()}
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

                  // non-image
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
        </>
      )}

      {/* GALLERY TAB */}
      {tab === "gallery" && (
        <div>
          <h3>Image Gallery</h3>

          <div
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              display: "grid",
              marginTop: 20,
              gap: 16,
            }}
          >
            {images.map((img) => (
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  padding: 10,
                }}
                key={img.id}
              >
                {/* Image */}
                <img
                  style={{
                    display: "block",
                    borderRadius: 8,
                    width: "100%",
                  }}
                  alt={img.filename}
                  src={img.url}
                />

                {/* Author */}
                <div
                  style={{
                    fontWeight: "bold",
                    marginTop: 10,
                  }}
                >
                  {img.author}
                </div>

                {/* Timestamp */}
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 4,
                  }}
                >
                  {new Date(img.timestamp).toLocaleString()}
                </div>

                {/* Caption / Message */}
                {img.content && (
                  <div style={{ marginTop: 8 }}>{img.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
