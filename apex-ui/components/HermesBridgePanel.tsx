"use client";

import { useState, useEffect } from "react";

interface HermesSession {
  id: string;
  name: string;
  created_at: string;
  message_count: number;
  agent?: string;
  provider?: string;
}

interface HermesStatus {
  hermes_home: string;
  uptime: number;
  memory: { rss: number; heapUsed: number };
  timestamp: string;
  features: Record<string, string>;
}

export default function HermesBridgePanel() {
  const [sessions, setSessions] = useState<HermesSession[]>([]);
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [skills, setSkills] = useState<{ name: string; description?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, statusRes, skillsRes] = await Promise.all([
          fetch("/api/mc/hermes/sessions?limit=10"),
          fetch("/api/mc/hermes/status"),
          fetch("/api/mc/hermes/skills"),
        ]);

        const sessionsData = await sessionsRes.json();
        const statusData = await statusRes.json();
        const skillsData = await skillsRes.json();

        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions);
        }
        if (statusData.hermes_home) {
          setStatus(statusData);
        }
        if (skillsData.skills) {
          setSkills(skillsData.skills);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a5f3fc" }}>
        Loading Hermes data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "#ef4444" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ color: "#a5f3fc", marginBottom: 16 }}>
        🔗 Hermes Bridge
      </h3>

      {/* Status */}
      {status && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={cardStyle}>
            <div style={labelStyle}>Uptime</div>
            <div style={valueStyle}>
              {Math.floor(status.uptime / 3600)}h {Math.floor((status.uptime % 3600) / 60)}m
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Memory</div>
            <div style={valueStyle}>{status.memory.rss} MB</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Sessions</div>
            <div style={valueStyle}>{sessions.length}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Skills</div>
            <div style={valueStyle}>{skills.length}</div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
          RECENT SESSIONS
        </h4>
        {sessions.length === 0 ? (
          <div style={{ color: "#666", fontSize: 12, padding: "10px 0" }}>
            No sessions found
          </div>
        ) : (
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={sessionStyle}
              >
                <span style={{ color: "#00e5ff" }}>{session.id.slice(0, 12)}...</span>
                <span style={{ color: "#888" }}>
                  {new Date(session.created_at).toLocaleTimeString()}
                </span>
                <span style={{ fontSize: 10, color: "#666" }}>
                  {session.message_count} msgs
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Skills */}
      <div>
        <h4 style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
          AVAILABLE SKILLS
        </h4>
        {skills.length === 0 ? (
          <div style={{ color: "#666", fontSize: 12, padding: "10px 0" }}>
            No skills found
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 8,
            }}
          >
            {skills.slice(0, 12).map((skill) => (
              <div key={skill.name} style={skillStyle}>
                {skill.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(6,14,26,0.72)",
  border: "1px solid rgba(0,229,255,0.15)",
  borderRadius: 6,
  padding: "10px 12px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 300,
  color: "#f0ede8",
};

const sessionStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "4px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  fontSize: 11,
};

const skillStyle: React.CSSProperties = {
  background: "rgba(0,229,255,0.1)",
  border: "1px solid rgba(0,229,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 10,
  color: "#a5f3fc",
  textAlign: "center",
};
