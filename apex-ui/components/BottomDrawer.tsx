'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Activity, Database, GitBranch, Terminal, BarChart3 } from 'lucide-react';

const ACCENT = '#00e5ff';
const GOLD = '#f5a623';
const BG_DARK = '#04080f';
const BG_CARD = 'rgba(15, 23, 42, 0.8)';
const BORDER = 'rgba(240, 237, 232, 0.15)';
const TEXT = '#f0ede8';
const TEXT_MUTED = '#94a3b8';

interface Health {
  status: string;
  database: string;
  version: string;
  uptime: number;
}

interface MenuFeature {
  key: string;
  icon: typeof Settings;
  label: string;
  desc: string;
  color: string;
  href?: string;
  onClick?: () => void;
}

export default function BottomDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/mc/health').then(r => r.json()).then(setHealth).catch(() => {});
      fetch('/api/mc/agents').then(r => r.json()).then(d => setAgents(d.agents || [])).catch(() => {});
    }
  }, [isOpen]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const features: MenuFeature[] = [
    {
      key: 'health',
      icon: Activity,
      label: 'System Health',
      desc: health ? `DB ${health.database} • v${health.version} • ${formatUptime(health.uptime)}` : 'Loading...',
      color: health?.database === 'connected' ? '#34d399' : '#ef4444',
    },
    {
      key: 'agents',
      icon: Database,
      label: 'Agents',
      desc: `${agents.length} active agents`,
      color: ACCENT,
    },
    {
      key: 'git',
      icon: GitBranch,
      label: 'Repository',
      desc: 'Niumination/mission-control',
      color: GOLD,
      href: 'https://github.com/Niumination',
    },
    {
      key: 'terminal',
      icon: Terminal,
      label: 'Terminal',
      desc: 'Open shell session',
      color: '#8b5cf6',
    },
    {
      key: 'stats',
      icon: BarChart3,
      label: 'Analytics',
      desc: 'View swarm metrics',
      color: '#f5a623',
    },
    {
      key: 'settings',
      icon: Settings,
      label: 'Settings',
      desc: 'Configure Mission Control',
      color: TEXT_MUTED,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 8, 15, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 150,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Bottom Drawer */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(4, 8, 15, 0.97)',
          borderTop: `1px solid ${BORDER}`,
          boxShadow: `0 -20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 ${ACCENT}20`,
          backdropFilter: 'blur(24px)',
          zIndex: 160,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '24px',
          maxHeight: '70vh',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ACCENT,
                boxShadow: `0 0 12px ${ACCENT}`,
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT }}>
              Mission Control Menu
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `1px solid ${BORDER}`,
              background: 'rgba(15, 23, 42, 0.5)',
              color: TEXT_MUTED,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid of Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {features.map((f) => {
            const Icon = f.icon;
            const Wrapper = f.href ? 'a' : 'div';
            const wrapperProps = f.href ? { href: f.href, target: '_blank', rel: 'noopener noreferrer' } : {};
            return (
              <Wrapper
                key={f.key}
                {...wrapperProps}
                onClick={f.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  background: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  cursor: f.href || f.onClick ? 'pointer' : 'default',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = f.color;
                  (e.currentTarget as HTMLElement).style.background = `${f.color}12`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = BORDER;
                  (e.currentTarget as HTMLElement).style.background = BG_CARD;
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${f.color}15`,
                    border: `1px solid ${f.color}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} style={{ color: f.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: TEXT, marginBottom: '2px' }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.desc}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}