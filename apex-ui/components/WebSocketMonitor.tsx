"use client";

import { useState, useEffect, useRef } from "react";

interface AgentState {
  [key: string]: {
    key: string;
    name: string;
    status: "online" | "busy" | "offline";
    task?: string | null;
    lastUpdate: string;
  };
}

interface SSEEvent {
  type: string;
  data?: AgentState;
  timestamp?: string;
}

export default function WebSocketMonitor() {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState("");
  const [agentState, setAgentState] = useState<AgentState>({});
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events]);

  useEffect(() => {
    const id = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setClientId(id);

    // Connect to SSE endpoint
    const es = new EventSource(`/api/mc/ws/sse?id=${id}`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setEvents((prev) => [
        ...prev,
        { type: "connected", timestamp: new Date().toISOString() },
      ]);
    };

    es.onmessage = (event) => {
      try {
        const msg: SSEEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev.slice(-20), msg]);
        if (msg.data) {
          setAgentState(msg.data);
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };

    es.onerror = () => {
      setConnected(false);
      setEvents((prev) => [
        ...prev,
        { type: "error", timestamp: new Date().toISOString() },
      ]);
    };

    return () => {
      es.close();
    };
  }, []);

  const handleAction = async (action: string, agent?: string, task?: string) => {
    try {
      const res = await fetch("/api/mc/ws/sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agent, task }),
      });
      const data = await res.json();
      setEvents((prev) => [
        ...prev,
        { type: action, data: data, timestamp: new Date().toISOString() },
      ]);
    } catch (e) {
      setEvents((prev) => [
        ...prev,
        { type: "error", timestamp: new Date().toISOString() },
      ]);
    }
  };

  return (
    <div style={{ padding: "20px 20px 10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ color: "#a5f3fc", margin: 0 }}>
          🔌 Live Agent Stream
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "#34d399" : "#ef4444",
              boxShadow: `0 0 8px ${connected ? "#34d399" : "#ef4444"}`,
            }}
          />
          <span style={{ fontSize: 11, color: "#888" }}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Agent Status Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {Object.values(agentState).map((agent) => (
          <div
            key={agent.key}
            style={{
              background: "rgba(6,14,26,0.72)",
              border: `1px solid ${
                agent.status === "busy"
                  ? "#f5a623"
                  : agent.status === "offline"
                    ? "#ef4444"
                    : "rgba(0,229,255,0.2)"
              }`,
              borderRadius: 6,
              padding: "8px 10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color:
                  agent.status === "busy"
                    ? "#f5a623"
                    : agent.status === "offline"
                      ? "#ef4444"
                      : "#34d399",
                marginBottom: 2,
              }}
            >
              {agent.status.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: "#f0ede8" }}>{agent.name}</div>
            {agent.task && (
              <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                {agent.task}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => handleAction("ping")} style={btnStyle}>
          🏓 Ping
        </button>
        {["chief", "research", "programmer", "qa", "creator"].map((a) => (
          <button
            key={a}
            onClick={() => handleAction("dispatch", a, "New task")}
            style={{ ...btnStyle, background: "#1e3a5f" }}
          >
            Dispatch {a}
          </button>
        ))}
        <button
          onClick={() => handleAction("complete", "chief")}
          style={{ ...btnStyle, background: "#1e3a5f" }}
        >
          ✓ Complete
        </button>
      </div>

      {/* Event Log */}
      <div
        style={{
          background: "rgba(0,0,0,0.4)",
          borderRadius: 6,
          padding: 10,
          maxHeight: 150,
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: 10,
        }}
      >
        {events.length === 0 && (
          <div style={{ color: "#666", textAlign: "center", padding: 20 }}>
            Connecting to stream...
          </div>
        )}
        {events.map((evt, i) => (
          <div
            key={i}
            style={{
              padding: "2px 0",
              color:
                evt.type === "error"
                  ? "#ef4444"
                  : evt.type === "connected"
                    ? "#34d399"
                    : "#a5f3fc",
            }}
          >
            <span style={{ color: "#555" }}>
              {new Date(evt.timestamp!).toLocaleTimeString()}
            </span>{" "}
            {evt.type}
          </div>
        ))}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "#00e5ff",
  color: "#000",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 500,
};
