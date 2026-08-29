"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, Terminal, Activity, ShieldCheck, Cpu } from "lucide-react";

type AgentInfo = {
  role: string;
  caps: string[];
  asks?: string[];
  status: "online" | "standby" | "integration";
};

/* Niumination 5-Agent Roster */
export const ROSTER: { key: string; name: string; color: string }[] = [
  { key: "chief",      name: "Hermes Chief",  color: "#00e5ff" },
  { key: "research",   name: "Research",      color: "#00e5ff" },
  { key: "programmer", name: "Programmer",    color: "#f5a623" },
  { key: "qa",         name: "QA Tester",     color: "#34d399" },
  { key: "creator",    name: "Kreator",       color: "#f5a623" },
];

/* Overview data per Niumination agent */
export const INFO: Record<string, AgentInfo> = {
  chief: { 
    role: "Orchestrator & Leader", 
    status: "online",
    caps: ["Memecah instruksi & route ke agent spesialis", "Koordinasi swarm loop", "Keputusan arsitektur tingkat tinggi"],
    asks: ["Apa instruksi utama hari ini?", "Status operasional swarm?"] 
  },
  research: { 
    role: "Research & Learn", 
    status: "online",
    caps: ["Web scraping & dokumentasi", "Membuat Research Brief ke active_spec.md", "Analisis referensi & literatur"],
    asks: ["Topik apa yang perlu diriset?", "Cek dokumentasi library X"] 
  },
  programmer: { 
    role: "Programmer & Coder", 
    status: "online",
    caps: ["Tulis, modifikasi, dan refactor source code", "Eksekusi berdasarkan active_spec.md", "Kepatuhan pada batasan project"],
    asks: ["Fitur apa yang perlu dikoding?", "Refactor modul Y"] 
  },
  qa: { 
    role: "Tester & QA", 
    status: "online",
    caps: ["Jalankan test suite & verifikasi build", "Kirim sinyal [PASS] atau [FAIL] dengan traceback", "Audit kualitas kode dan regresi"],
    asks: ["Jalankan test suite", "Cek error log terbaru"] 
  },
  creator: { 
    role: "Content Creator", 
    status: "online",
    caps: ["Drafting laporan, ringkasan, dan konten", "Format narasi yang rapi dan engaging", "Penyusunan dokumentasi publik"],
    asks: ["Buat rangkuman progres", "Draft laporan mingguan"] 
  },
};

const STATUS_LINE: Record<AgentInfo["status"], { color: string; text: string }> = {
  online: { color: "#34d399", text: "Online - Swarm routing active" },
  standby: { color: "#c9a84c", text: "Standby - Ready for tasks" },
  integration: { color: "#7f9bb3", text: "Integration - Core connected" },
};

export function AgentOverview({ sel, onClose }: { sel: { key: string; name: string; color: string }; onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const info = INFO[sel.key] ?? { role: "Specialist", status: "online" as const, caps: ["Bagian dari Niumination Swarm"] };
  const status = STATUS_LINE[info.status];

  useEffect(() => {
    setPos({ x: Math.max(8, window.innerWidth / 2 - 170), y: Math.max(90, window.innerHeight * 0.16) });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!pos) return null;

  return (
    <div 
      className="fixed z-50 w-[340px] rounded-2xl border border-cyan-500/30 bg-black/80 p-5 text-cyan-100 backdrop-blur-xl shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: sel.color }} />
          <h3 className="font-bold text-lg text-white">{sel.name}</h3>
        </div>
        <button onClick={onClose} className="text-cyan-400 hover:text-white">
          <X size={18} />
        </button>
      </div>
      <div className="py-3 text-sm space-y-2">
        <p className="text-cyan-300 font-medium">{info.role}</p>
        <div className="text-xs text-emerald-400 flex items-center space-x-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
          <span>{status.text}</span>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Capabilities:</p>
          <ul className="list-disc list-inside text-xs text-cyan-200/80 space-y-1">
            {info.caps.map((cap, i) => (
              <li key={i}>{cap}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
