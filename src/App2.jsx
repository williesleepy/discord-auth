import { useEffect, useState, useMemo } from "react";

const API = "https://discord-auth.williesleepy.workers.dev";

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [heartEvents, setHeartEvents] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [heartLoadingId, setHeartLoadingId] = useState(null);

  const [tab, setTab] = useState("chat");
  const [filter, setFilter] = useState("all");

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

        await loadHeartEvents();
      } catch (err) {
        console.error(err);
        setUser(null);
        setMessages([]);
        setHeartEvents([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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

      await loadHeartEvents();
    } catch (err) {
      console.error(err);
      setUser(null);
      setMessages([]);
      setHeartEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHeartEvents() {
    const token = getToken();

    if (!token) return;

    const res = await fetch(`${API}/heart-events/all`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to load heart events");
    }

    const events = await res.json();
    setHeartEvents(events);
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

  async function loadAllMessages() {
    const token = getToken();

    if (!token) return;

    setMessagesLoadingMore(true);

    try {
      const res = await fetch(`${API}/messages/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load full message history");
      }

      const allMessages = await res.json();

      setMessages(allMessages);
      setHasMoreMessages(false);

      await loadHeartEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoadingMore(false);
    }
  }

  async function toggleHeart(targetMessageId, hasHearted) {
    const token = getToken();

    if (!token) return;

    setHeartLoadingId(targetMessageId);

    try {
      const action = hasHearted ? "unheart" : "heart";

      const res = await fetch(`${API}/heart-event`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetMessageId,
          action,
        }),
        method: "POST",
      });

      if (!res.ok) {
        console.error("Heart event failed:", res.status, await res.text());
        return;
      }

      await loadHeartEvents();
    } catch (err) {
      console.error("Heart event failed:", err);
    } finally {
      setHeartLoadingId(null);
    }
  }

  const heartState = useMemo(() => {
    return buildHeartState(heartEvents);
  }, [heartEvents]);

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      const heart = getHeartForMessage(heartState, msg.id, user?.id);

      switch (filter) {
        case "my-requests":
          return msg.author?.id === user?.id;

        case "unhearted":
          return heart.count === 0;

        case "my-hearts":
          return heart.hasHearted;

        case "hearted":
          return heart.count > 0;

        case "images":
          return (msg.attachments || []).some((att) =>
            att.content_type?.startsWith("image/"),
          );

        default:
          return true;
      }
    });
  }, [messages, heartState, filter, user?.id]);

  const images = useMemo(() => {
    return filteredMessages.flatMap((msg) =>
      (msg.attachments || [])
        .filter((att) => att.content_type?.startsWith("image/"))
        .map((att) => ({
          nativeReactions: msg.reactions || [],
          discord_url: msg.discord_url,
          author: msg.author?.username,
          timestamp: msg.timestamp,
          filename: att.filename,
          content: msg.content,
          messageId: msg.id,
          url: att.url,
          id: att.id,
        })),
    );
  }, [filteredMessages]);

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
      </div>

      <FilterBar setFilter={setFilter} filter={filter} />

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

            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              {hasMoreMessages && (
                <button
                  disabled={messagesLoadingMore}
                  onClick={loadMoreMessages}
                >
                  {messagesLoadingMore ? "Loading..." : "Load More"}
                </button>
              )}

              <button disabled={messagesLoadingMore} onClick={loadAllMessages}>
                {messagesLoadingMore ? "Loading..." : "Load Full History"}
              </button>
            </div>

            {filteredMessages.map((msg) => {
              const heart = getHeartForMessage(heartState, msg.id, user.id);

              return (
                <DiscordMessage
                  heartLoadingId={heartLoadingId}
                  onToggleHeart={toggleHeart}
                  heart={heart}
                  key={msg.id}
                  msg={msg}
                />
              );
            })}
          </div>
        </>
      )}

      {tab === "gallery" && (
        <div>
          <h3>Image Gallery</h3>

          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            {hasMoreMessages && (
              <button disabled={messagesLoadingMore} onClick={loadMoreMessages}>
                {messagesLoadingMore ? "Loading..." : "Load More"}
              </button>
            )}

            <button disabled={messagesLoadingMore} onClick={loadAllMessages}>
              {messagesLoadingMore ? "Loading..." : "Load Full History"}
            </button>
          </div>

          <div
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              display: "grid",
              marginTop: 20,
              gap: 16,
            }}
          >
            {images.map((img) => {
              const heart = getHeartForMessage(
                heartState,
                img.messageId,
                user.id,
              );

              return (
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

                  {img.discord_url && (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={img.discord_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open in Discord
                      </a>
                    </div>
                  )}

                  <HeartButton
                    loading={heartLoadingId === img.messageId}
                    targetMessageId={img.messageId}
                    onToggleHeart={toggleHeart}
                    heart={heart}
                  />

                  <ReactionList reactions={img.nativeReactions} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function DiscordMessage({ heartLoadingId, onToggleHeart, heart, msg }) {
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

      {msg.discord_url && (
        <div style={{ marginTop: 10 }}>
          <a href={msg.discord_url} rel="noreferrer" target="_blank">
            Open in Discord
          </a>
        </div>
      )}

      <HeartButton
        loading={heartLoadingId === msg.id}
        onToggleHeart={onToggleHeart}
        targetMessageId={msg.id}
        heart={heart}
      />

      <ReactionList reactions={msg.reactions} />
    </div>
  );
}

function FilterBar({ setFilter, filter }) {
  const filters = [
    { value: "all", label: "All" },
    { value: "hearted", label: "Hearted" },
    { value: "unhearted", label: "Unhearted" },
    { value: "my-hearts", label: "My Hearts" },
    { value: "my-requests", label: "My Requests" },
    { label: "Images Only", value: "images" },
  ];

  return (
    <div
      style={{
        flexWrap: "wrap",
        marginBottom: 20,
        display: "flex",
        gap: 8,
      }}
    >
      {filters.map((item) => {
        const active = filter === item.value;

        return (
          <button
            style={{
              border: active ? "2px solid #333" : "1px solid #ccc",
              fontWeight: active ? "bold" : "normal",
            }}
            onClick={() => setFilter(item.value)}
            key={item.value}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ReactionList({ reactions }) {
  if (!reactions?.length) return null;

  return (
    <div
      style={{
        flexWrap: "wrap",
        display: "flex",
        marginTop: 10,
        gap: 8,
      }}
    >
      {reactions.map((reaction) => {
        const key = reaction.emoji.id || reaction.emoji.name;

        return (
          <span
            style={{
              border: "1px solid #ccc",
              padding: "4px 8px",
              borderRadius: 999,
              fontSize: 13,
            }}
            key={key}
          >
            {formatReactionEmoji(reaction.emoji)} {reaction.count}
          </span>
        );
      })}
    </div>
  );
}

function buildHeartState(events) {
  const state = {};

  const chronologicalEvents = [...events].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );

  for (const event of chronologicalEvents) {
    if (!state[event.targetMessageId]) {
      state[event.targetMessageId] = {};
    }

    if (event.action === "heart") {
      state[event.targetMessageId][event.userId] = {
        timestamp: event.timestamp,
        username: event.username,
        userId: event.userId,
      };
    }

    if (event.action === "unheart") {
      delete state[event.targetMessageId][event.userId];
    }
  }

  return state;
}

function HeartButton({ targetMessageId, onToggleHeart, loading, heart }) {
  return (
    <button
      onClick={() => onToggleHeart(targetMessageId, heart.hasHearted)}
      style={{ marginTop: 10 }}
      disabled={loading}
    >
      {heart.hasHearted ? "💔 Remove Heart" : "❤️ Heart"} {heart.count}
    </button>
  );
}

function getHeartForMessage(heartState, messageId, userId) {
  const users = heartState[messageId] || {};
  const count = Object.keys(users).length;

  return {
    hasHearted: Boolean(users[userId]),
    count,
  };
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

function formatReactionEmoji(emoji) {
  if (!emoji) return "";

  if (emoji.id) {
    return `:${emoji.name}:`;
  }

  return emoji.name;
}
