"use client";

import { useState, useEffect } from "react";

interface Agent {
  key: string;
  name: string;
  role: string;
  status: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  agent: string;
  priority: string;
  progress?: number;
}

interface Log {
  id: number;
  timestamp: string;
  agent: string;
  level: string;
  message: string;
}

export default function MCDataPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({
    pending: [],
    running: [],
    completed: [],
    failed: [],
  });
  const [logs, setLogs] = useState<Log[]>([]);
  const [system, setSystem] = useState<any>(null);
  const [cost, setCost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, tasksRes, logsRes, systemRes, costRes] =
          await Promise.all([
            fetch("/api/mc/agents"),
            fetch("/api/mc/tasks"),
            fetch("/api/mc/logs"),
            fetch("/api/mc/system"),
            fetch("/api/mc/cost"),
          ]);

        setAgents((await agentsRes.json()).agents);
        setTasks((await tasksRes.json()));
        setLogs((await logsRes.json()).logs);
        setSystem((await systemRes.json()));
        setCost((await costRes.json()));
      } catch (err) {
        console.error("Failed to fetch MC data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a5f3fc" }}>
        Loading Mission Control data...
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h2 style={{ color: "#a5f3fc", marginBottom: 20 }}>
        🎯 Mission Control v3.0
      </h2>

      {/* System Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={cardStyle}
        >
          <div style={labelStyle}>System Uptime</div>
          <div style={valueStyle}>
            {system?.uptime
              ? `${Math.floor(system.uptime / 3600)}h ${Math.floor(
                  (system.uptime % 3600) / 60
                )}m`
              : "-"}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Memory RSS</div>
          <div style={valueStyle}>
            {system?.memory?.rss ? `${system.memory.rss} MB` : "-"}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Platform</div>
          <div style={valueStyle}>{system?.platform?.toUpperCase() || "-"}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Node Version</div>
          <div style={valueStyle}>{system?.nodeVersion || "-"}</div>
        </div>
      </div>

      {/* Agents */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={sectionTitle}>🤖 Agent Swarm ({agents.length})</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {agents.map((agent) => (
            <div key={agent.key} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: agent.status === "online" ? agent.color : "#666",
                  }}
                />
                <span style={labelStyle}>{agent.name}</span>
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>{agent.role}</div>
              <div
                style={{
                  fontSize: 10,
                  color: agent.status === "online" ? "#34d399" : "#f59e0b",
                  marginTop: 4,
                }}
              >
                {agent.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={sectionTitle}>📋 Tasks</h3>
        {(["pending", "running", "completed", "failed"] as const).map(
          (col) => (
            <div key={col} style={{ marginBottom: 12 }}>
              <div style={columnHeader}>
                {col.toUpperCase()} ({tasks[col]?.length || 0})
              </div>
              {(tasks[col] || []).map((task) => (
                <div key={task.id} style={taskStyle}>
                  <span>{task.title}</span>
                  <span style={{ fontSize: 10, color: "#888" }}>
                    @{task.agent}
                  </span>
                  {task.progress !== undefined && (
                    <div
                      style={{
                        height: 4,
                        background: "#333",
                        borderRadius: 2,
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${task.progress}%`,
                          background: "#00e5ff",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Logs */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={sectionTitle}>📜 Recent Logs</h3>
        <div style={logContainer}>
          {logs.slice(-10).reverse().map((log) => (
            <div key={log.id} style={logStyle}>
              <span style={{ color: "#888" }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  color:
                    log.level === "error"
                      ? "#ef4444"
                      : log.level === "warn"
                        ? "#f59e0b"
                        : "#34d399",
                }}
              >
                [{log.level.toUpperCase()}]
              </span>
              <span style={{ color: "#00e5ff" }}>@{log.agent}</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div>
        <h3 style={sectionTitle}>💰 Cost Summary</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <div style={cardStyle}>
            <div style={labelStyle}>Today</div>
            <div style={{ ...valueStyle, color: "#00e5ff" }}>
              ${cost?.today?.total?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>This Week</div>
            <div style={{ ...valueStyle, color: "#f5a623" }}>
              ${cost?.week?.total?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>This Month</div>
            <div style={{ ...valueStyle, color: "#34d399" }}>
              ${cost?.month?.total?.toFixed(2) || "0.00"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(6,14,26,0.72)",
  border: "1px solid rgba(0,229,255,0.2)",
  borderRadius: 8,
  padding: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 300,
  color: "#f0ede8",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  color: "#a5f3fc",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
};

const columnHeader: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  textTransform: "uppercase",
  marginBottom: 4,
};

const taskStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderRadius: 4,
  padding: "6px 10px",
  marginBottom: 4,
  fontSize: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const logContainer: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  borderRadius: 8,
  padding: 12,
  maxHeight: 200,
  overflowY: "auto",
};

const logStyle: React.CSSProperties = {
  fontSize: 11,
  marginBottom: 4,
  fontFamily: "monospace",
  display: "flex",
  gap: 8,
};
