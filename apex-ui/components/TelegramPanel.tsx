"use client";

import { useState, useEffect } from "react";

interface TelegramMessage {
  id: string;
  chat_id: string;
  message: string;
  timestamp: string;
  type: "incoming" | "outgoing";
  topic?: string;
}

interface TelegramStatus {
  connected: boolean;
  running: boolean;
  streaming: boolean;
  socket_exists: boolean;
  pid_exists: boolean;
}

export default function TelegramPanel() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTelegramData = async () => {
    try {
      const [feedRes, statusRes] = await Promise.all([
        fetch("/api/mc/telegram/feed?limit=30"),
        fetch("/api/mc/telegram/status"),
      ]);

      const feedData = await feedRes.json();
      const statusData = await statusRes.json();

      if (feedData.messages) {
        setMessages(feedData.messages);
      }
      if (statusData.connected !== undefined) {
        setStatus(statusData);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelegramData();
    const interval = setInterval(fetchTelegramData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!sendMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/mc/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: sendMessage,
          chat_id: "home",
          topic: "1",
        }),
      });

      const data = await res.json();
      if (data.sent) {
        setSendMessage("");
        await fetchTelegramData(); // Refresh feed
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a5f3fc" }}>
        Loading Telegram...
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ color: "#a5f3fc", margin: 0 }}>📱 Telegram Feed</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status?.connected ? "#34d399" : "#ef4444",
            }}
          />
          <span style={{ fontSize: 11, color: "#888" }}>
            {status?.connected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Status Info */}
      {status && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={cardStyle}>
            <div style={labelStyle}>Gateway</div>
            <div style={valueStyle}>
              {status.running ? "✓ Running" : "✗ Stopped"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Streaming</div>
            <div style={valueStyle}>
              {status.streaming ? "✓ On" : "○ Off"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Messages</div>
            <div style={valueStyle}>{messages.length}</div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          type="text"
          value={sendMessage}
          onChange={(e) => setSendMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Send message to Telegram..."
          style={{
            flex: 1,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(0,229,255,0.2)",
            borderRadius: 6,
            padding: "8px 12px",
            color: "#f0ede8",
            fontSize: 12,
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !sendMessage.trim()}
          style={{
            ...btnStyle,
            opacity: sending || !sendMessage.trim() ? 0.5 : 1,
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>

      {/* Message Feed */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 8,
          padding: 12,
          maxHeight: 250,
          overflowY: "auto",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#666", textAlign: "center", padding: 20, fontSize: 12 }}>
            No Telegram messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 10, color: "#666", minWidth: 60 }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: msg.type === "incoming" ? "#34d399" : "#00e5ff",
                  minWidth: 50,
                }}
              >
                {msg.type.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: "#f0ede8", flex: 1 }}>
                {msg.message}
              </span>
            </div>
          ))
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "#ef4444", fontSize: 11 }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(6,14,26,0.72)",
  border: "1px solid rgba(0,229,255,0.15)",
  borderRadius: 6,
  padding: "8px 10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#f0ede8",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#00e5ff",
  color: "#000",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};
