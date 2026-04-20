import { useEffect, useState } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = () => {
    window.location.href = `${API}/login`;
  };

  useEffect(() => {
    fetch(`${API}/me`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <button onClick={login}>Login with Discord</button>;
  }

  return (
    <div>
      <h1>Welcome {user.username}</h1>
      <p>ID: {user.id}</p>
    </div>
  );
}
