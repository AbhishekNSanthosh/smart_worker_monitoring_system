"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    setVisible(true);

    const fadeTimer = setTimeout(() => setFadeOut(true), 2000);
    const hideTimer = setTimeout(() => setVisible(false), 2500);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#FFFFFF",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.5s ease",
      pointerEvents: fadeOut ? "none" : "all",
    }}>
      <div style={{
        textAlign: "center",
        animation: "splashIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
      }}>
        {/* Logo mark */}
        <div style={{
          width: "72px", height: "72px", borderRadius: "18px",
          background: "linear-gradient(135deg, #2563EB, #3B82F6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 32px rgba(37,99,235,0.2)",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        {/* Brand name */}
        <div style={{
          fontSize: "1.5rem", fontWeight: 800, color: "#0F172A",
          letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "6px",
          fontFamily: "Outfit, system-ui, sans-serif",
        }}>
          Smart Worker Monitor
        </div>
        <div style={{
          fontSize: "0.8125rem", color: "#94A3B8",
          fontWeight: 500, marginBottom: "36px",
          fontFamily: "Outfit, system-ui, sans-serif",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          AI Analytics Platform
        </div>

        {/* Loading bar */}
        <div style={{
          width: "160px", height: "3px",
          background: "#E2E8F0",
          borderRadius: "99px", margin: "0 auto", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: "99px",
            background: "linear-gradient(90deg, #2563EB, #3B82F6)",
            animation: "splashBar 2s cubic-bezier(0.4,0,0.2,1) forwards",
          }} />
        </div>
      </div>

      <style>{`
        @keyframes splashIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashBar {
          0%   { width: 0%; }
          20%  { width: 15%; }
          60%  { width: 65%; }
          85%  { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
