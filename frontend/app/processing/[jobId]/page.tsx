"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, JobStatus } from "@/lib/api";
import {
  CheckCircle, Clock, AlertCircle, Shield, Activity,
  ChevronRight, Loader2, ArrowRight, Terminal, Cpu,
  Users, Film, Zap, CalendarClock
} from "lucide-react";

function formatTimeWithSeconds(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatEta(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const STAGES = [
  { label: "Upload Received", icon: <Film size={15} /> },
  { label: "Extracting Frames", icon: <Cpu size={15} /> },
  { label: "Detecting Humans", icon: <Users size={15} /> },
  { label: "Tracking Individuals", icon: <Activity size={15} /> },
  { label: "Calculating Analytics", icon: <Zap size={15} /> },
  { label: "Rendering Output Video", icon: <Film size={15} /> },
  { label: "Preparing Dashboard", icon: <CheckCircle size={15} /> },
];

function parseLogLevel(line: string): "info" | "success" | "warning" | "error" | "text" {
  if (line.includes("[SUCCESS]") || line.includes("[DONE]")) return "success";
  if (line.includes("[WARNING]") || line.includes("[WARN]")) return "warning";
  if (line.includes("[ERROR]")) return "error";
  if (line.includes("[INFO]")) return "info";
  return "text";
}

interface LogEntry {
  text: string;
  timestamp: string;
}

function LogLine({ entry }: { entry: LogEntry }) {
  const level = parseLogLevel(entry.text);
  const colorMap = {
    info: "#60A5FA",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    text: "#94A3B8",
  };
  return (
    <div className="console-log" style={{ color: colorMap[level], marginBottom: "3px", display: "flex", gap: "8px", fontSize: "0.8rem", lineHeight: 1.5 }}>
      <span style={{ color: "#334155", flexShrink: 0, userSelect: "none" }}>[{entry.timestamp}]</span>
      <span>{entry.text}</span>
    </div>
  );
}

function NavBar() {
  return (
    <nav style={{
      background: "#FFFFFF",
      borderBottom: "1px solid #E2E8F0",
      padding: "0 5vw",
      height: "64px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 50,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #2563EB, #3B82F6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Shield size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
            Smart Worker Monitor
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500 }}>
            AI Analytics Platform
          </div>
        </div>
      </div>
      <div className="badge badge-yellow">
        <Loader2 size={11} style={{ animation: "spin 1.5s linear infinite" }} />
        Processing
      </div>
    </nav>
  );
}

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const rawJobId = params.jobId;
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : (rawJobId ?? "");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [localEta, setLocalEta] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(0); // seconds since last poll
  const prevLogsRef = useRef<string[]>([]);

  const poll = useCallback(async () => {
    try {
      const s = await api.getStatus(jobId);
      setStatus(s);
      setLocalEta(s.eta_seconds);
      setLastUpdated(0);

      // Append only new log lines with timestamps
      const prevLogs = prevLogsRef.current;
      const newLines = s.logs.slice(prevLogs.length);
      if (newLines.length > 0) {
        const now = formatTimeWithSeconds(new Date());
        setLogEntries((prev) => [
          ...prev,
          ...newLines.map((text) => ({ text, timestamp: now })),
        ]);
        prevLogsRef.current = s.logs;
      }

      if (s.status === "completed") {
        setDone(true);
      } else if (s.status === "failed") {
        setError("Processing failed. Please check the backend logs.");
      }
    } catch {
      setError("Cannot reach backend. Is it running on port 8000?");
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || done) return;
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [poll, done, jobId]);

  // Local ETA countdown — ticks every second between polls
  useEffect(() => {
    if (done || localEta <= 0) return;
    const t = setInterval(() => {
      setLocalEta((prev) => Math.max(0, prev - 1));
      setLastUpdated((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [done, localEta]);

  // Auto-redirect countdown
  useEffect(() => {
    if (!done) return;
    
    if (countdown <= 0) {
      router.push(`/dashboard/${jobId}`);
      return;
    }

    const t = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    
    return () => clearTimeout(t);
  }, [done, countdown, jobId, router]);

  // Prevent accidental exit while processing
  useEffect(() => {
    if (done || error) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Video processing is still in progress. Leaving now will not stop the backend job, but you will lose progress tracking.";
      return e.returnValue;
    };

    // Push a history entry so the back button triggers popstate instead of navigating away
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowExitWarning(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [done, error]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries]);

  const progress = status?.progress ?? 0;
  const stageIndex = status?.stage_index ?? 0;
  const framesProcessed = status?.frames_processed ?? 0;
  const totalFrames = status?.total_frames ?? 0;
  const workersDetected = status?.workers_detected ?? 0;
  const estimatedFinishTime = !done && localEta > 0
    ? formatTimeWithSeconds(new Date(Date.now() + localEta * 1000))
    : null;
  const framePercent = totalFrames > 0 ? Math.round((framesProcessed / totalFrames) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <NavBar />

      {/* Exit confirmation modal */}
      {showExitWarning && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="card animate-fade-in" style={{ maxWidth: 420, width: "90%", padding: "28px 28px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "18px" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#FFF1F2", border: "1px solid #FECDD3",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <AlertCircle size={22} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1rem", marginBottom: 4 }}>
                  Leave processing page?
                </div>
                <div style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
                  Video processing is still in progress. The backend job will continue, but you will lose live tracking until you return.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowExitWarning(false)}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "1px solid #E2E8F0",
                  background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                }}
              >
                Stay on page
              </button>
              <button
                onClick={() => { setShowExitWarning(false); router.back(); }}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "none",
                  background: "#DC2626", color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                }}
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ padding: "40px 5vw" }}>

        {/* Do-not-leave banner */}
        {!done && !error && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px",
            padding: "10px 16px", marginBottom: "20px",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "0.8125rem", color: "#92400E", fontWeight: 500 }}>
              Processing in progress — please keep this tab open. Closing or navigating away will not cancel the job but you will lose live tracking.
            </span>
          </div>
        )}

        {/* Page header */}
        <div className="animate-fade-in" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>Dashboard</span>
            <ChevronRight size={14} color="#CBD5E1" />
            <span style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>Processing</span>
            <ChevronRight size={14} color="#CBD5E1" />
            <span style={{ fontSize: "0.8125rem", color: "#2563EB", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
              {jobId?.slice(0, 12)}…
            </span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
            Processing Video Analysis
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "#64748B", marginTop: "4px" }}>
            AI models are detecting and analyzing worker activity in your video.
          </p>
        </div>

        {/* Success Banner */}
        {done && (
          <div className="animate-slide-up" style={{
            background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)",
            border: "1px solid #BBF7D0",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "50%",
              background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#15803D", fontSize: "1rem" }}>
                Analysis Complete! 🎉
              </div>
              <div style={{ fontSize: "0.875rem", color: "#16A34A", marginTop: "2px" }}>
                Redirecting to dashboard in <strong>{countdown}s</strong>…
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ background: "#16A34A", flexShrink: 0 }}
              onClick={() => router.push(`/dashboard/${jobId}`)}
            >
              View Dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div style={{
            background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: "12px",
            padding: "16px 20px", marginBottom: "24px",
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <AlertCircle size={18} color="#DC2626" />
            <span style={{ fontSize: "0.875rem", color: "#DC2626" }}>{error}</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px", alignItems: "start" }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Progress Card */}
            <div className="card animate-slide-up" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <div className="section-label" style={{ marginBottom: "4px" }}>Overall Progress</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>
                    {done ? "Processing Complete" : status?.stage ?? "Initializing…"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#2563EB", lineHeight: 1 }}>
                    {progress}
                  </div>
                  <div style={{ fontSize: "1rem", color: "#64748B", fontWeight: 600 }}>%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-bar-track" style={{ height: "10px", marginBottom: "16px" }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%`, height: "10px" }} />
              </div>

              {/* ETA row */}
              {!done && localEta > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: "10px",
                  background: "#F8FAFC", borderRadius: "8px", padding: "10px 14px",
                  border: "1px solid #E2E8F0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "0.8125rem" }}>
                    <Clock size={14} color="#2563EB" />
                    <span>Time remaining:</span>
                    <strong style={{ color: "#2563EB" }}>{formatEta(localEta)}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "0.8125rem" }}>
                    <CalendarClock size={14} color="#7C3AED" />
                    <span>Estimated finish:</span>
                    <strong style={{ color: "#7C3AED" }}>{estimatedFinishTime}</strong>
                  </div>
                </div>
              )}

              {/* Frame sub-progress */}
              {totalFrames > 0 && !done && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Frames processed</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>
                      {framesProcessed.toLocaleString()} / {totalFrames.toLocaleString()} ({framePercent}%)
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ height: "6px" }}>
                    <div className="progress-bar-fill" style={{
                      width: `${framePercent}%`, height: "6px",
                      background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Stage Pipeline */}
            <div className="card animate-slide-up" style={{ padding: "24px" }}>
              <div className="section-label" style={{ marginBottom: "16px" }}>Processing Pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {STAGES.map((stage, idx) => {
                  const isCompleted = idx < stageIndex;
                  const isActive = idx === stageIndex && !done;
                  const isPending = idx > stageIndex;
                  return (
                    <div key={stage.label} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: isActive ? "#EFF6FF" : isCompleted ? "#F0FDF4" : "#F8FAFC",
                      border: isActive ? "1px solid #BFDBFE" : isCompleted ? "1px solid #BBF7D0" : "1px solid transparent",
                      transition: "all 0.3s ease",
                    }}>
                      {/* Status icon */}
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        background: isCompleted ? "#22C55E" : isActive ? "#2563EB" : "#E2E8F0",
                      }}>
                        {isCompleted ? (
                          <CheckCircle size={14} color="#fff" />
                        ) : isActive ? (
                          <Loader2 size={14} color="#fff" style={{ animation: "spin 1.5s linear infinite" }} />
                        ) : (
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94A3B8" }} />
                        )}
                      </div>
                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: "0.875rem",
                          fontWeight: isActive ? 700 : isCompleted ? 600 : 400,
                          color: isActive ? "#1D4ED8" : isCompleted ? "#15803D" : "#94A3B8",
                        }}>
                          {stage.label}
                        </div>
                      </div>
                      {/* Step icon */}
                      <div style={{ color: isPending ? "#CBD5E1" : isActive ? "#2563EB" : "#22C55E" }}>
                        {stage.icon}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Logs */}
            <div className="card animate-slide-up" style={{ padding: "0", overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex", alignItems: "center", gap: "10px",
                background: "#F8FAFC",
              }}>
                <Terminal size={16} color="#475569" />
                <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151" }}>Live Processing Logs</span>
                <span className="badge badge-blue" style={{ marginLeft: "auto" }}>
                  {logEntries.length} lines
                </span>
                {!done && (
                  <>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "#22C55E" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }} />
                      Live
                    </span>
                    {lastUpdated > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                        {lastUpdated}s ago
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={{
                background: "#0F172A",
                padding: "16px 20px",
                height: "300px",
                overflowY: "auto",
                fontFamily: "JetBrains Mono, monospace",
              }}>
                {logEntries.length === 0 ? (
                  <div style={{ color: "#475569", fontSize: "0.8125rem", fontFamily: "JetBrains Mono, monospace" }}>
                    Waiting for logs…
                  </div>
                ) : (
                  logEntries.map((entry, i) => <LogLine key={i} entry={entry} />)
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Status indicators */}
            <div className="card" style={{ padding: "20px" }}>
              <div className="section-label" style={{ marginBottom: "14px" }}>Live Stats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    label: "Status",
                    value: done ? "Completed" : error ? "Failed" : "Processing",
                    badge: done ? "badge-green" : error ? "badge-red" : "badge-yellow",
                    icon: done ? <CheckCircle size={14} /> : error ? <AlertCircle size={14} /> : <Loader2 size={14} style={{ animation: "spin 1.5s linear infinite" }} />,
                  },
                  {
                    label: "Frames Processed",
                    value: totalFrames > 0 ? `${framesProcessed} / ${totalFrames}` : `${framesProcessed}`,
                    badge: "badge-blue",
                    icon: <Film size={14} />,
                  },
                  {
                    label: "Workers Detected",
                    value: `${workersDetected} person${workersDetected !== 1 ? "s" : ""}`,
                    badge: "badge-gray",
                    icon: <Users size={14} />,
                  },
                  ...(!done && localEta > 0 ? [{
                    label: "Time Remaining",
                    value: formatEta(localEta),
                    badge: "badge-blue",
                    icon: <Clock size={14} />,
                  }] : []),
                  ...(!done && estimatedFinishTime ? [{
                    label: "Est. Finish Time",
                    value: estimatedFinishTime,
                    badge: "badge-blue",
                    icon: <CalendarClock size={14} />,
                  }] : []),
                ].map((item) => (
                  <div key={item.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                  }}>
                    <span style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500 }}>{item.label}</span>
                    <span className={`badge ${item.badge}`}>
                      {item.icon}
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Job info */}
            <div className="card" style={{ padding: "20px" }}>
              <div className="section-label" style={{ marginBottom: "14px" }}>Job Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "3px" }}>Job ID</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8125rem", color: "#374151", wordBreak: "break-all" }}>
                    {jobId}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "10px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "3px" }}>Current Stage</div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                    {done ? "Complete ✓" : status?.stage ?? "Initializing…"}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "10px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "6px" }}>Stage Progress</div>
                  <div className="progress-bar-track" style={{ height: "6px" }}>
                    <div className="progress-bar-fill" style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%`, height: "6px" }} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "6px" }}>
                    Stage {stageIndex + 1} of {STAGES.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Tips card */}
            <div style={{
              background: "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
              border: "1px solid #BFDBFE",
              borderRadius: "12px",
              padding: "20px",
            }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1D4ED8", marginBottom: "12px" }}>
                💡 What's Happening
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  "YOLOv8 detects every person in each frame",
                  "ByteTrack assigns consistent IDs across frames",
                  "Zone logic tracks area occupancy patterns",
                  "Analytics are aggregated per person & zone",
                ].map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{
                      width: "18px", height: "18px", borderRadius: "50%",
                      background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: "1px",
                    }}>
                      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#fff" }}>{i + 1}</span>
                    </div>
                    <span style={{ fontSize: "0.8125rem", color: "#1E40AF", lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
