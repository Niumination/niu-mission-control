import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niumination Mission Control — 5-Agent Swarm Dashboard",
  description:
    "Personal AI OS Dashboard — animated orb + reasoning-graph UI. Hand-written SVG/CSS + R3F, zero-build pipeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
