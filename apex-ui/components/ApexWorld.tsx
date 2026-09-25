"use client";

/**
 * ApexWorld — main dashboard viewport.
 * Layers:
 *   1. Backdrop radial + shader waves
 *   2. Light-cast (state-driven warna/intensitas)
 *   3. ReasoningWeb (dengan roster live dari SSE)
 *   4. Orb core (ApexHeroOrb) — state di-drive dari useOrbState()
 *   5. Tap disc (manual override boost, kembali ke derived state setelah 8s)
 *   6. Stat cards (top-right), ActivityFeed (bottom-right)
 *   7. ApprovalBanner (di atas orb saat review pending)
 *   8. OrbStatusBar (equalizer di bawah orb)
 *   9. AgentOverview popups
 */

import { useEffect, useRef, useState } from "react";
import ApexHeroOrb, { type OrbState } from "./ApexHeroOrb";
import ReasoningWebJs from "./ReasoningWeb";
import ShaderBackgroundJs from "./ShaderBackground";
import OrbStatusBar from "./OrbStatusBar";
import { useOrbState } from "@/lib/client/useOrbState";
import { useReasoningWebState } from "@/lib/client/useReasoningWebState";
import StatCards from "./StatCards";
import ApprovalBanner from "./ApprovalBanner";

export type NodeSel = { name: string; key: string; color: string };

// the copied .jsx defaults onSelect to null, which TS infers as `null | undefined`
const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{
  state?: string; trace?: unknown; mode?: string; coreless?: boolean;
  onSelect?: (n: NodeSel) => void; light?: boolean;
}>;
const ShaderBackground = ShaderBackgroundJs as unknown as React.ComponentType<{
  opacity?: number; voiceActive?: boolean; gold?: boolean;
}>;
type AgentInfo = {
  role: string;
  caps: string[];
  asks?: string[];
  status: "online" | "standby" | "integration";
};

/* Niumination 5-agent roster (Chief + Research + Programmer + QA + Kreator) */
export const ROSTER: { key: string; name: string; color: string }[] = [
  { key: "chief",      name: "Hermes Chief",   color: "#00e5ff" },
  { key: "research",   name: "Research",        color: "#00e5ff" },
  { key: "programmer", name: "Programmer",      color: "#f5a623" },
  { key: "qa",         name: "QA Tester",       color: "#34d399" },
  { key: "creator",    name: "Kreator",         color: "#f5a623" },
];

/* Overview data per Niumination agent */
export const INFO: Record<string, AgentInfo> = {
  chief: { role: "Orchestrator & Leader", status: "online",
    caps: ["Memecah instruksi & route ke agent spesialis", "Koordinasi swarm loop", "Keputusan arsitektur tingkat tinggi"],
    asks: ["Apa instruksi utama hari ini?", "Status operasional swarm?"] },
  research: { role: "Research & Learn", status: "online",
    caps: ["Web scraping & dokumentasi", "Membuat Research Brief ke active_spec.md", "Analisis referensi & literatur"],
    asks: ["Topik apa yang perlu diriset?", "Cek dokumentasi library X"] },
  programmer: { role: "Programmer & Coder", status: "online",
    caps: ["Tulis, modifikasi, dan refactor source code", "Eksekusi berdasarkan active_spec.md", "Kepatuhan pada batasan project"],
    asks: ["Fitur apa yang perlu dikoding?", "Refactor modul Y"] },
  qa: { role: "Tester & QA", status: "online",
    caps: ["Jalankan test suite & verifikasi build", "Kirim sinyal [PASS] atau [FAIL] dengan traceback", "Audit kualitas kode dan regresi"],
    asks: ["Jalankan test suite", "Cek error log terbaru"] },
  creator: { role: "Content Creator", status: "online",
    caps: ["Drafting laporan, ringkasan, dan konten", "Format narasi yang rapi dan engaging", "Penyusunan dokumentasi publik"],
    asks: ["Buat rangkuman progres", "Draft laporan mingguan"] },
};

const STATUS_LINE: Record<AgentInfo["status"], { color: string; text: string }> = {
  online: { color: "#34d399", text: "Online - Niumination swarm routing active" },
  standby: { color: "#c9a84c", text: "Standby - Ready for tasks" },
  integration: { color: "#7f9bb3", text: "Integration - Core connected" },
};

/* ── AGENT OVERVIEW window - the site's template (the app opens live cockpits) ── */
export function AgentOverview({ sel, onClose }: { sel: NodeSel; onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const info = INFO[sel.key] ?? { role: "Specialist", status: "online" as const, caps: ["Part of the Apex core"] };
  const c = sel.color;
  const status = STATUS_LINE[info.status];

  useEffect(() => {
    setPos({ x: Math.max(8, window.innerWidth / 2 - 170), y: Math.max(90, window.innerHeight * 0.16) });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the window when it opens and hand it back on close, so the
  // keyboard does not stay stranded on the agent list behind it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus(); };
  }, [pos]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    dragRef.current = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.sx, y: ev.clientY - dragRef.current.sy });
    };
    const up = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  if (!pos) return null;
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${sel.name} overview`} style={{
      position: "fixed", left: pos.x, top: pos.y,
      width: "min(340px, 92vw)", zIndex: 60,
      background: "rgba(4,3,12,0.92)",
      backdropFilter: "blur(24px)",
      border: `1px solid ${c}44`,
      borderRadius: 16,
      boxShadow: `0 0 40px ${c}18, 0 8px 32px rgba(0,0,0,0.6)`,
      overflow: "hidden",
    }}>
      {/* header - drag handle */}
      <div onMouseDown={onMouseDown} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: `1px solid ${c}22`, cursor: "grab", userSelect: "none",
        background: `linear-gradient(135deg, ${c}0a 0%, transparent 100%)`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: `${c}14`,
          border: `1px solid ${c}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: c }}>{sel.name.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{info.role}</div>
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "6px 8px", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >×</button>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>WHAT IT HANDLES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {info.caps.map((cap) => (
              <div key={cap} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: `${c}99`, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {info.asks && info.asks.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>EXAMPLE REQUESTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {info.asks.map((task) => (
                <span key={task} style={{
                  padding: "4px 10px", background: `${c}0d`, border: `1px solid ${c}2a`,
                  borderRadius: 20, fontSize: 10.5, color: `${c}cc`,
                }}>{task}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: `1px solid ${c}1a`, paddingTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{status.text}</span>
        </div>
      </div>
    </div>
  );
}

/* ── The world ── */
export default function ApexWorld() {
  // SSE diinisialisasi di AppShell layout (singleton, guard ref) — stores live saat komponen ini mount.
  const [selected, setSelected] = useState<NodeSel | null>(null);
  const [reduced, setReduced] = useState(false);

  // Derive orb state realtime dari stores (SSE-driven)
  const orb = useOrbState();
  const web = useReasoningWebState();

  // Manual tap boost — sementara override state ke "speaking" selama 3 detik
  // (feedback visual saat user klik orb), lalu kembali ke derived state.
  const [manualBoostUntil, setManualBoostUntil] = useState<number>(0);
  const boost = () => {
    setManualBoostUntil(Date.now() + 3000);
  };

  // Orb state final: derived dari data, di-override jika manual boost aktif
  const derived: OrbState = orb.state;
  const isManualBoost = Date.now() < manualBoostUntil;
  const orbState: OrbState = isManualBoost ? 'speaking' : derived;
  const intensity = isManualBoost ? 2 : orb.intensity;

  // Single entry point for opening an agent, shared by the SVG graph and the
  // hidden accessible list, so both routes behave identically.
  const openAgent = (n: NodeSel) => {
    setSelected(n);
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Map orb state → ReasoningWeb state string
  const webState =
    orbState === "thinking" ? "processing" :
    orbState === "speaking" ? "speaking" :
    orbState === "alert" ? "processing" :
    orbState === "offline" ? "standby" :
    "standby";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", userSelect: "none" }}>
      {/* backdrop - state-tinted */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background:
          orbState === "alert"
            ? "radial-gradient(ellipse 95% 88% at 50% 42%, #2d1215 0%, #1a0d14 38%, #0a0609 72%, #050305 100%)"
            : orbState === "offline"
            ? "radial-gradient(ellipse 95% 88% at 50% 42%, #1a1a1f 0%, #0f0f15 38%, #07070b 72%, #030305 100%)"
            : "radial-gradient(ellipse 95% 88% at 50% 42%, #122c43 0%, #0c1d30 38%, #07111f 72%, #050b14 100%)",
        transition: "background 1s ease",
      }} />

      {/* background waves - opacity menyesuaikan intensity */}
      {!reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.08 + intensity * 0.04 }}>
          <ShaderBackground
            opacity={0.12 + intensity * 0.04}
            voiceActive={orbState === "speaking"}
            gold={orbState === "alert"}
          />
        </div>
      )}

      {/* LIGHT-CAST — warna & intensitas berubah per state */}
      {(() => {
        const isSpeak = orbState === "speaking";
        const isAlert = orbState === "alert";
        const isOffline = orbState === "offline";
        const isThinking = orbState === "thinking";
        const baseOpacity = isOffline ? 0.06 : isAlert ? 0.22 : isSpeak ? 0.30 : isThinking ? 0.18 + intensity * 0.04 : 0.15;
        const castColor = isAlert ? "rgba(239,68,68," : isOffline ? "rgba(148,163,184," : "rgba(13,210,255,";
        const secondColor = isAlert ? "rgba(245,166,35," : isOffline ? "rgba(100,116,139," : "rgba(13,170,228,";
        return (
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", mixBlendMode: "screen",
            background: `radial-gradient(circle at 50% 42%, ${castColor}${baseOpacity}) 0%, ${secondColor}${(baseOpacity * 0.4).toFixed(2)}) 30%, rgba(8,17,31,0) 62%)`,
            transition: "background 0.6s ease",
            animation: isAlert ? "orb-alert-shake 0.5s ease-in-out infinite" : "none",
            transformOrigin: "50% 50%",
          }} />
        );
      })()}

      {/* the reasoning web - app z-order: web (z13) sits BELOW the orb canvas (z15),
          so the bloom haze washes over the lines near the centre, exactly like the app */}
      {/* ReasoningWeb is a verbatim copy from the Apex app: its 18 agent nodes are
          imperative SVG hit-areas with no tabindex, inside an svg[role=img] that
          collapses the whole graph into a single image. Rather than edit the copy,
          the graph is marked decorative here and the same onSelect path is exposed
          through the equivalent list of real buttons below. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
        {(() => {
          const RW: any = ReasoningWeb;
          return (
            <RW
              state={webState}
              mode="full"
              coreless
              roster={web.roster}
              trace={{ n: web.pulseKey, trace: web.traceIds.map((id: string) => ({ helper: id })) }}
              onSelect={(n: NodeSel) => { openAgent(n); }}
            />
          );
        })()}
      </div>

      {/* Keyboard and screen-reader equivalent of the agent graph. */}
      <nav className="visually-hidden" aria-label="Apex agents">
        <ul>
          {ROSTER.map((a) => (
            <li key={a.key}>
              <button type="button" onClick={() => openAgent({ key: a.key, name: a.name, color: a.color })}>
                {a.name} - {INFO[a.key]?.role ?? "Specialist"}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Approval banner (muncul saat ada task review/approval pending) */}
      <ApprovalBanner />

      {/* the core - painted ABOVE the web, dengan state-tinted filter */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: "min(560px, 58vw)", height: "min(500px, 56vw, 70vh)",
        transform: "translate(-50%, -50%)",
        zIndex: 3, pointerEvents: "none",
        filter: orbState === "alert"
          ? "drop-shadow(0 0 30px rgba(239,68,68,0.6))"
          : orbState === "offline"
          ? "saturate(0.2) brightness(0.7)"
          : orbState === "thinking"
          ? `drop-shadow(0 0 ${15 + intensity * 8}px rgba(0,229,255,${0.25 + intensity * 0.1}))`
          : "none",
        transition: "filter 1s ease",
      }}>
        <ApexHeroOrb state={orbState} interactive={false} />
      </div>

      {/* central tap disc - covers the ring only (nodes orbit outside it) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Apex core - tap to energize"
        onClick={boost}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boost(); } }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: "min(340px, 36vw)", height: "min(340px, 36vw)", borderRadius: "50%",
          zIndex: 4, cursor: "pointer", background: "transparent", border: "none", userSelect: "none",
        }}
      />

      {/* Realtime stat cards (top-right HUD) */}
      <StatCards />

      {/* equalizer + STANDBY cluster */}
      <OrbStatusBar state={orbState} />

      {selected && <AgentOverview sel={selected} onClose={() => setSelected(null)} />}

      {/* Global keyframes untuk state-driven animasi */}
      <style>{`
        @keyframes orb-alert-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          50% { transform: translateX(2px); }
          75% { transform: translateX(-1px); }
        }
      `}</style>
    </div>
  );
}
