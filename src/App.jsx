import { useEffect, useState } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

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

    async function load() {
      try {
        const userRes = await fetch(`${API}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userRes.ok) throw new Error("auth failed");

        const userData = await userRes.json();
        setUser(userData);

        const msgRes = await fetch(`${API}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!msgRes.ok) throw new Error("messages failed");

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

    load();
  }, []);

  const login = () => {
    window.location.href = `${API}/login`;
  };

  const sendMessage = async () => {
    const token = getToken();

    if (!token || !input.trim()) return;

    try {
      await fetch(`${API}/send`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: input }),
        method: "POST",
      });

      setInput("");

      const res = await fetch(`${API}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <button onClick={login}>Login with Discord</button>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome {user.username}</h2>

      <div style={{ marginTop: 20 }}>
        <input
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message"
          value={input}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Messages</h3>
        {messages.map((msg) => (
          <div key={msg.id}>{msg.content}</div>
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

function getTokenFromUrl() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace("#", ""));
  return params.get("token");
}
