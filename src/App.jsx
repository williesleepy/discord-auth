import { useEffect, useState } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokenFromUrl = getTokenFromUrl();

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    window.location.href = `${API}/login`;
  };

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <button onClick={login}>Login with Discord</button>;
  }

  return <div>Welcome {user.username}</div>;
}

function getTokenFromUrl() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace("#", ""));
  return params.get("token");
}
