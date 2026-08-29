import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Niumination Mission Control — 5-Agent Swarm Dashboard",
  description:
    "Personal AI OS Dashboard — animated orb + reasoning-graph UI. Hand-written SVG/CSS + R3F, zero-build pipeline.",
  authors: [{ name: "Niumination" }],
  keywords: ["mission-control", "ai", "agents", "dashboard", "niumination"],
  openGraph: {
    title: "Niumination Mission Control",
    description: "5-Agent Swarm Dashboard",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ErrorBoundary>
          <ThemeToggle />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
