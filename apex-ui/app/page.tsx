import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";
import MCDataPanel from "@/components/MCDataPanel";
import WebSocketMonitor from "@/components/WebSocketMonitor";

export default function Home() {
  return (
    <main
      id="main"
      style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "auto" }}
    >
      {/* Top-left overview HUD: clock + weather + social links */}
      <ApexOverviewPanel />

      {/* The world: orb core + orbiting agent graph */}
      <section style={{ position: "relative", height: "50vh", minHeight: 400 }}>
        <ApexWorld />
      </section>

      {/* Mission Control Data Panel */}
      <section style={{ position: "relative", background: "rgba(4,8,15,0.9)" }}>
        <MCDataPanel />
      </section>

      {/* WebSocket Real-time Monitor */}
      <section style={{ position: "relative", background: "rgba(4,8,15,0.95)", borderTop: "1px solid rgba(0,229,255,0.1)" }}>
        <WebSocketMonitor />
      </section>

      {/* Repo link — attribution to upstream APEX-UI */}
      <a
        href="https://github.com/RubenM1990/APEX-UI"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute", top: 16, right: "clamp(16px,3vw,40px)", zIndex: 40,
          fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.24em",
          textTransform: "uppercase", color: "rgba(240,237,232,0.7)", textDecoration: "none",
          border: "1px solid rgba(240,237,232,0.2)", borderRadius: 20, padding: "7px 15px",
          background: "rgba(4,8,15,0.5)", backdropFilter: "blur(6px)",
        }}
      >
        Built on APEX-UI ↗
      </a>
    </main>
  );
}
