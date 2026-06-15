import { useEffect, useState, useMemo } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const [tab, setTab] = useState("chat");

  const [r2Prefix, setR2Prefix] = useState("");
  const [r2Folders, setR2Folders] = useState([]);
  const [r2Files, setR2Files] = useState([]);
  const [r2Search, setR2Search] = useState("");
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Cursor, setR2Cursor] = useState(null);
  const [r2HasMore, setR2HasMore] = useState(false);
  const [r2LoadingMore, setR2LoadingMore] = useState(false);

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

  useEffect(() => {
    if (
      tab === "files" &&
      user &&
      r2Folders.length === 0 &&
      r2Files.length === 0
    ) {
      loadR2Folder("");
    }
  }, [tab, user, r2Folders.length, r2Files.length]);

  async function load() {
    const token = getToken();

    if (!token) return;

    try {
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

      const msgRes = await fetch(`${API}/messages?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!msgRes.ok) {
        throw new Error("Message fetch failed");
      }

      const msgData = await msgRes.json();

      setMessages(msgData);
      setHasMoreMessages(msgData.length === 50);
    } catch (err) {
      console.error(err);
      setUser(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreMessages() {
    const token = getToken();

    if (!token || messages.length === 0) return;

    const oldestMessage = messages[messages.length - 1];

    setMessagesLoadingMore(true);

    try {
      const res = await fetch(
        `${API}/messages?limit=50&before=${oldestMessage.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to load older messages");
      }

      const olderMessages = await res.json();

      setMessages((prev) => [...prev, ...olderMessages]);

      if (olderMessages.length < 50) {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoadingMore(false);
    }
  }

  async function loadR2Folder(prefix = "") {
    const token = getToken();

    if (!token) return;

    setR2Loading(true);

    try {
      const res = await fetch(
        `${API}/r2/list?prefix=${encodeURIComponent(prefix)}&limit=25`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error("R2 list failed");
      }

      const data = await res.json();

      setR2Prefix(data.prefix || "");
      setR2Folders(data.folders || []);
      setR2Files(data.files || []);
      setR2Cursor(data.cursor || null);
      setR2HasMore(Boolean(data.truncated));
      setR2Search("");
    } catch (err) {
      console.error(err);
      setR2Folders([]);
      setR2Files([]);
      setR2Cursor(null);
      setR2HasMore(false);
    } finally {
      setR2Loading(false);
    }
  }

  async function loadMoreR2Files() {
    const token = getToken();

    if (!token || !r2Cursor) return;

    setR2LoadingMore(true);

    try {
      const res = await fetch(
        `${API}/r2/list?prefix=${encodeURIComponent(
          r2Prefix,
        )}&limit=25&cursor=${encodeURIComponent(r2Cursor)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error("R2 load more failed");
      }

      const data = await res.json();

      setR2Folders((prev) => [...prev, ...(data.folders || [])]);
      setR2Files((prev) => [...prev, ...(data.files || [])]);
      setR2Cursor(data.cursor || null);
      setR2HasMore(Boolean(data.truncated));
    } catch (err) {
      console.error(err);
    } finally {
      setR2LoadingMore(false);
    }
  }

  const login = () => {
    window.location.href = `${API}/login`;
  };

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

  const filteredR2Folders = useMemo(() => {
    const q = r2Search.trim().toLowerCase();

    if (!q) return r2Folders;

    return r2Folders.filter((folder) => folder.name?.toLowerCase().includes(q));
  }, [r2Folders, r2Search]);

  const filteredR2Files = useMemo(() => {
    const q = r2Search.trim().toLowerCase();

    if (!q) return r2Files;

    return r2Files.filter((file) => file.name?.toLowerCase().includes(q));
  }, [r2Files, r2Search]);

  const imageFiles = filteredR2Files.filter((file) => isImageFile(file.name));
  const otherFiles = filteredR2Files.filter((file) => !isImageFile(file.name));

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <button onClick={login}>Login with Discord</button>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome {user.username}</h2>

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
        <button onClick={() => setTab("files")}>Files</button>
      </div>

      {tab === "chat" && (
        <>
          <div style={{ marginBottom: 30 }}>
            <input
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message"
              value={input}
            />

            <input onChange={(e) => setFile(e.target.files[0])} type="file" />

            <button onClick={sendMessage}>Send</button>
          </div>

          <div>
            <h3>Messages</h3>

            {messages.map((msg) => (
              <DiscordMessage key={msg.id} msg={msg} />
            ))}

            {hasMoreMessages && (
              <button
                disabled={messagesLoadingMore}
                onClick={loadMoreMessages}
                style={{ marginTop: 10 }}
              >
                {messagesLoadingMore ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        </>
      )}

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
                <img
                  style={{
                    display: "block",
                    borderRadius: 8,
                    width: "100%",
                  }}
                  alt={img.filename}
                  src={img.url}
                />

                <div style={{ fontWeight: "bold", marginTop: 10 }}>
                  {img.author}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 4,
                  }}
                >
                  {new Date(img.timestamp).toLocaleString()}
                </div>

                {img.content && (
                  <div style={{ marginTop: 8 }}>{img.content}</div>
                )}
              </div>
            ))}
          </div>

          {hasMoreMessages && (
            <button
              disabled={messagesLoadingMore}
              onClick={loadMoreMessages}
              style={{ marginTop: 20 }}
            >
              {messagesLoadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}

      {tab === "files" && (
        <div>
          <h3>R2 File Explorer</h3>

          <Breadcrumbs onNavigate={loadR2Folder} prefix={r2Prefix} />

          <input
            style={{
              display: "block",
              marginBottom: 20,
              width: "100%",
              maxWidth: 400,
            }}
            onChange={(e) => setR2Search(e.target.value)}
            placeholder="Search current folder"
            value={r2Search}
          />

          {r2Loading && <div>Loading R2 folder...</div>}

          {!r2Loading && (
            <>
              <h4>Folders</h4>

              {filteredR2Folders.length === 0 && <div>No folders</div>}

              <div style={{ marginBottom: 24 }}>
                {filteredR2Folders.map((folder) => (
                  <button
                    onClick={() => loadR2Folder(folder.prefix)}
                    style={{ marginBottom: 8, marginRight: 8 }}
                    key={folder.prefix}
                  >
                    📁 {folder.name}
                  </button>
                ))}
              </div>

              <h4>Images</h4>

              {imageFiles.length === 0 && <div>No images</div>}

              <div
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  marginBottom: 30,
                  display: "grid",
                  gap: 16,
                }}
              >
                {imageFiles.map((file) => (
                  <R2ImageCard key={file.key} file={file} />
                ))}
              </div>

              <h4>Other Files</h4>

              {otherFiles.length === 0 && <div>No other files</div>}

              <div>
                {otherFiles.map((file) => (
                  <div
                    style={{
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      marginBottom: 8,
                      padding: 10,
                    }}
                    key={file.key}
                  >
                    <div>📄 {file.name}</div>

                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {file.path}
                    </div>

                    {file.size && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {Math.round(file.size / 1024)} KB
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {r2HasMore && (
                <button
                  onClick={loadMoreR2Files}
                  style={{ marginTop: 20 }}
                  disabled={r2LoadingMore}
                >
                  {r2LoadingMore ? "Loading..." : "Load More Files"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function R2ImageCard({ file }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url = null;

    async function loadImage() {
      const token = getToken();

      if (!token) return;

      try {
        const res = await fetch(
          `${API}/r2/file?path=${encodeURIComponent(file.path)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          setFailed(true);
          return;
        }

        const blob = await res.blob();
        url = URL.createObjectURL(blob);

        if (!cancelled) {
          setObjectUrl(url);
        }
      } catch (err) {
        console.error("R2 image failed:", err);
        setFailed(true);
      }
    }

    loadImage();

    return () => {
      cancelled = true;

      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file.path]);

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div
        style={{
          justifyContent: "center",
          aspectRatio: "1 / 1",
          alignItems: "center",
          background: "#eee",
          overflow: "hidden",
          borderRadius: 8,
          display: "flex",
          width: "100%",
        }}
      >
        {objectUrl && (
          <img
            style={{
              objectFit: "contain",
              display: "block",
              height: "100%",
              width: "100%",
            }}
            src={objectUrl}
            alt={file.name}
          />
        )}

        {!objectUrl && !failed && <span>Loading...</span>}
        {failed && <span>Failed</span>}
      </div>

      <div
        style={{
          wordBreak: "break-word",
          marginTop: 8,
          fontSize: 13,
        }}
      >
        {file.name}
      </div>

      {file.size && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {Math.round(file.size / 1024)} KB
        </div>
      )}
    </div>
  );
}

function DiscordMessage({ msg }) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        marginBottom: 12,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
        {msg.author?.username}
      </div>

      <div
        style={{
          marginBottom: 10,
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        {new Date(msg.timestamp).toLocaleString()}
      </div>

      {msg.content && <div style={{ marginBottom: 10 }}>{msg.content}</div>}

      {msg.attachments?.map((att) => {
        const isImage = att.content_type?.startsWith("image/");

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

        return (
          <div style={{ marginTop: 10 }} key={att.id}>
            <a rel="noreferrer" target="_blank" href={att.url}>
              {att.filename}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function Breadcrumbs({ onNavigate, prefix }) {
  const clean = prefix.replace(/\/$/, "");

  if (!clean) {
    return (
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => onNavigate("")}>Home</button>
      </div>
    );
  }

  const parts = clean.split("/");

  const crumbs = [
    {
      label: "Home",
      prefix: "",
    },
    ...parts.map((part, index) => ({
      prefix: parts.slice(0, index + 1).join("/") + "/",
      label: part,
    })),
  ];

  return (
    <div style={{ marginBottom: 12 }}>
      {crumbs.map((crumb, index) => (
        <span key={crumb.prefix}>
          <button onClick={() => onNavigate(crumb.prefix)}>
            {crumb.label}
          </button>
          {index < crumbs.length - 1 && <span> / </span>}
        </span>
      ))}
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

function isImageFile(name = "") {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}
