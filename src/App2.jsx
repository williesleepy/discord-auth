import { useEffect, useState, useMemo } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("chat");

  const [pcloudPath, setPcloudPath] = useState("/");
  const [pcloudContents, setPcloudContents] = useState([]);
  const [pcloudSearch, setPcloudSearch] = useState("");
  const [pcloudLoading, setPcloudLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewName, setPreviewName] = useState("");

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
    if (tab === "pcloud" && user) {
      loadPcloudFolder(pcloudPath);
    }
  }, [tab, pcloudPath, user]);

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

  async function loadPcloudFolder(path) {
    const token = getToken();

    if (!token) return;

    setPcloudLoading(true);
    setPreviewUrl(null);
    setPreviewName("");

    try {
      const res = await fetch(
        `${API}/pcloud/list?folder=${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error("pCloud folder fetch failed");
      }

      const data = await res.json();
      const contents = data.metadata?.contents || [];

      setPcloudContents(contents);
    } catch (err) {
      console.error(err);
      setPcloudContents([]);
    } finally {
      setPcloudLoading(false);
    }
  }

  async function renderPcloudFile(item) {
    const token = getToken();

    if (!token) return;

    if (!isImageFile(item.name)) {
      console.warn("Preview only supports images right now:", item.name);
      return;
    }

    try {
      const filePath = buildPath(pcloudPath, item.name);

      console.log("Fetching pCloud preview:", filePath);

      const res = await fetch(
        `${API}/pcloud/file?path=${encodeURIComponent(filePath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      console.log("status:", res.status);
      console.log("content-type:", res.headers.get("Content-Type"));

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(url);
      setPreviewName(item.name);
    } catch (err) {
      console.error("Preview failed:", err);
    }
  }

  //   async function renderPcloudFile(item) {
  //     const token = getToken();

  //     if (!token) return;

  //     if (!isImageFile(item.name)) {
  //       window.open(item.filelink || "#", "_blank");
  //       return;
  //     }

  //     try {
  //       const filePath = item.path || buildPath(pcloudPath, item.name);

  //       const res = await fetch(
  //         `${API}/pcloud/file?path=${encodeURIComponent(filePath)}`,
  //         {
  //           headers: {
  //             Authorization: `Bearer ${token}`,
  //           },
  //         },
  //       );

  //       if (!res.ok) {
  //         throw new Error("pCloud file fetch failed");
  //       }

  //       const blob = await res.blob();
  //       const url = URL.createObjectURL(blob);

  //       if (previewUrl) {
  //         URL.revokeObjectURL(previewUrl);
  //       }

  //       setPreviewUrl(url);
  //       setPreviewName(item.name);
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   }

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

  const filteredPcloudContents = useMemo(() => {
    const q = pcloudSearch.trim().toLowerCase();

    if (!q) return pcloudContents;

    return pcloudContents.filter((item) =>
      item.name?.toLowerCase().includes(q),
    );
  }, [pcloudContents, pcloudSearch]);

  const pcloudFolders = filteredPcloudContents.filter((item) => item.isfolder);
  const pcloudFiles = filteredPcloudContents.filter((item) => !item.isfolder);

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
        <button onClick={() => setTab("pcloud")}>pCloud</button>
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
              <div
                style={{
                  border: "1px solid #ccc",
                  marginBottom: 12,
                  borderRadius: 8,
                  padding: 12,
                }}
                key={msg.id}
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

                {msg.content && (
                  <div style={{ marginBottom: 10 }}>{msg.content}</div>
                )}

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
            ))}
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
        </div>
      )}

      {tab === "pcloud" && (
        <div>
          <h3>pCloud File Explorer</h3>

          <div style={{ marginBottom: 12 }}>
            {getBreadcrumbs(pcloudPath).map((crumb, index, arr) => (
              <span key={crumb.path}>
                <button
                  onClick={() => {
                    setPcloudPath(crumb.path);
                    setPcloudSearch("");
                  }}
                >
                  {crumb.label}
                </button>
                {index < arr.length - 1 && <span> / </span>}
              </span>
            ))}
          </div>

          <input
            onChange={(e) => setPcloudSearch(e.target.value)}
            style={{ marginBottom: 20, display: "block" }}
            placeholder="Search current folder"
            value={pcloudSearch}
          />

          {pcloudLoading && <div>Loading pCloud folder...</div>}

          {!pcloudLoading && (
            <div
              style={{
                gridTemplateColumns: "1fr 1fr",
                display: "grid",
                gap: 20,
              }}
            >
              <div>
                <h4>Folders</h4>

                {pcloudFolders.length === 0 && <div>No folders</div>}

                {pcloudFolders.map((folder) => {
                  const folderPath =
                    folder.path || buildPath(pcloudPath, folder.name);

                  return (
                    <div
                      key={folder.folderid || folderPath}
                      style={{ marginBottom: 8 }}
                    >
                      <button
                        onClick={() => {
                          setPcloudPath(folderPath);
                          setPcloudSearch("");
                        }}
                      >
                        📁 {folder.name}
                      </button>
                    </div>
                  );
                })}

                <h4 style={{ marginTop: 24 }}>Files</h4>

                {pcloudFiles.length === 0 && <div>No files</div>}

                {pcloudFiles.map((item) => (
                  <div
                    style={{
                      border: "1px solid #ccc",
                      marginBottom: 8,
                      borderRadius: 8,
                      padding: 10,
                    }}
                    key={item.fileid || item.path || item.name}
                  >
                    <div>
                      {isImageFile(item.name) ? "🖼️" : "📄"} {item.name}
                    </div>

                    {item.size && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {Math.round(item.size / 1024)} KB
                      </div>
                    )}

                    <button
                      onClick={() => renderPcloudFile(item)}
                      style={{ marginTop: 8 }}
                    >
                      {isImageFile(item.name) ? "Preview" : "Open"}
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <h4>Preview</h4>

                {!previewUrl && <div>Select an image file to preview.</div>}

                {previewUrl && (
                  <div>
                    <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                      {previewName}
                    </div>

                    <img
                      style={{
                        border: "1px solid #ccc",
                        maxWidth: "100%",
                        borderRadius: 8,
                      }}
                      alt={previewName}
                      src={previewUrl}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getBreadcrumbs(path) {
  if (path === "/") {
    return [{ label: "Home", path: "/" }];
  }

  const parts = path.split("/").filter(Boolean);

  return [
    { label: "Home", path: "/" },
    ...parts.map((part, index) => ({
      path: "/" + parts.slice(0, index + 1).join("/"),
      label: part,
    })),
  ];
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

function buildPath(parent, name) {
  if (parent === "/") return `/${name}`;
  return `${parent}/${name}`;
}

function isImageFile(name = "") {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}
