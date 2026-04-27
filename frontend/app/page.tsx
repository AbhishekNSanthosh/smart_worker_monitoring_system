"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, formatTime, Session } from "@/lib/api";
import {
  Upload, Wifi, Play, CheckCircle, Clock, AlertCircle,
  FileVideo, X, ChevronRight, Activity, Shield, BarChart3,
  Camera, Loader2, ArrowRight, History, Eye
} from "lucide-react";

const STAGES = [
  "Upload Received",
  "Extracting Frames",
  "Detecting Humans",
  "Tracking Individuals",
  "Calculating Analytics",
  "Rendering Output Video",
  "Preparing Dashboard",
];

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
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A", lineHeight: 1.2 }}>
            Smart Worker Monitor
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500 }}>
            AI Analytics Platform
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div className="badge badge-green">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          System Online
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#64748B", marginLeft: "12px" }}>
          v1.1.0
        </div>
      </div>
    </nav>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "6px 14px",
      background: "#EFF6FF",
      border: "1px solid #BFDBFE",
      borderRadius: "99px",
      fontSize: "0.8125rem",
      fontWeight: 500,
      color: "#1D4ED8",
    }}>
      {icon}
      {label}
    </div>
  );
}

function StatsCard({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "2px" }}>{label}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [rtspUrl, setRtspUrl] = useState("");
  const [rtspError, setRtspError] = useState("");
  const [startingRtsp, setStartingRtsp] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {});
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("video/")) {
      setFile(dropped);
      setUploadError("");
    } else {
      setUploadError("Please upload a valid video file.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setUploadError("");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const { job_id } = await api.uploadVideo(file, setUploadProgress);
      router.push(`/processing/${job_id}`);
    } catch {
      setUploadError("Upload failed. Please ensure the backend is running.");
      setUploading(false);
    }
  };

  const handleRtsp = async () => {
    if (!rtspUrl.startsWith("rtsp://") && !rtspUrl.startsWith("http")) {
      setRtspError("Please enter a valid RTSP or HTTP stream URL.");
      return;
    }
    setStartingRtsp(true);
    setRtspError("");
    try {
      const { job_id } = await api.startRtsp(rtspUrl);
      router.push(`/processing/${job_id}`);
    } catch {
      setRtspError("Could not connect to stream. Check URL and backend.");
      setStartingRtsp(false);
    }
  };

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : "0";

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <NavBar />

      {/* Hero — Upload front and center */}
      <div style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #F8FAFC 100%)",
        borderBottom: "1px solid #E2E8F0",
        padding: "56px 5vw 64px",
        textAlign: "center",
      }}>
        <div className="animate-fade-in" style={{ marginBottom: "40px" }}>
          <div className="badge badge-blue" style={{ marginBottom: "16px", display: "inline-flex" }}>
            <Activity size={12} />
            AI-Powered · Real-Time · Enterprise Grade
          </div>
          <h1 style={{
            fontSize: "clamp(1.75rem, 3.5vw, 2.625rem)", fontWeight: 800,
            color: "#0F172A", lineHeight: 1.15, marginBottom: "12px",
            letterSpacing: "-0.02em",
          }}>
            Smart Worker Monitoring System
          </h1>
          <p style={{
            fontSize: "1rem", color: "#475569", maxWidth: "520px",
            margin: "0 auto", lineHeight: 1.65, fontWeight: 400,
          }}>
            Drop a video and get instant AI-powered analytics — detections, tracking, and zone reports.
          </p>
        </div>

        {/* Upload hero card */}
        <div className="card animate-slide-up" style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "32px",
          boxShadow: "0 4px 24px rgba(37,99,235,0.08), 0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {/* Drop Zone */}
          <div
            className={`drag-zone ${dragActive ? "drag-active" : ""}`}
            style={{ padding: "48px 24px", textAlign: "center", marginBottom: "20px", cursor: file ? "default" : "pointer" }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
                <FileVideo size={32} color="#2563EB" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.9375rem" }}>{file.name}</div>
                  <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "2px" }}>{fileSizeMB} MB · {file.type}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setUploadProgress(0); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "16px",
                  background: "#EFF6FF", display: "flex", alignItems: "center",
                  justifyContent: "center", margin: "0 auto 16px",
                }}>
                  <Upload size={28} color="#2563EB" />
                </div>
                <p style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.0625rem", marginBottom: "6px" }}>
                  Drag & drop your video here
                </p>
                <p style={{ fontSize: "0.875rem", color: "#94A3B8", marginBottom: "16px" }}>
                  or click to browse files
                </p>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                  {["MP4", "AVI", "MOV", "MKV", "WEBM"].map((fmt) => (
                    <span key={fmt} className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>{fmt}</span>
                  ))}
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.8125rem", color: "#475569" }}>Uploading…</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#2563EB" }}>{uploadProgress}%</span>
              </div>
              <div className="progress-bar-track" style={{ height: "8px" }}>
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%`, height: "8px" }} />
              </div>
            </div>
          )}

          {uploadError && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px", background: "#FFF1F2", borderRadius: "8px",
              border: "1px solid #FECDD3", marginBottom: "16px",
            }}>
              <AlertCircle size={15} color="#DC2626" />
              <span style={{ fontSize: "0.8125rem", color: "#DC2626" }}>{uploadError}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn-primary"
              style={{ flex: 1, justifyContent: "center", padding: "12px 20px", fontSize: "0.9375rem" }}
              onClick={handleAnalyze}
              disabled={!file || uploading}
            >
              {uploading ? (
                <><Loader2 size={18} className="animate-spin-slow" /> Processing…</>
              ) : (
                <><Play size={18} /> Analyze Video</>
              )}
            </button>
            {file && !uploading && (
              <button className="btn-secondary" style={{ padding: "12px 18px" }} onClick={() => fileInputRef.current?.click()}>
                Change
              </button>
            )}
          </div>
        </div>

        {/* Feature pills below the card */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
          <FeaturePill icon={<Shield size={13} />} label="YOLOv8 Detection" />
          <FeaturePill icon={<Activity size={13} />} label="ByteTrack Tracking" />
          <FeaturePill icon={<BarChart3 size={13} />} label="Zone Analytics" />
          <FeaturePill icon={<Camera size={13} />} label="Live CCTV Support" />
        </div>
      </div>

      <main style={{ padding: "48px 5vw" }}>
        {/* Platform stats bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "48px",
        }}>
          {[
            { icon: <Activity size={20} color="#2563EB" />, value: "99.2%", label: "Detection Accuracy", color: "#EFF6FF" },
            { icon: <Clock size={20} color="#16A34A" />, value: "< 2s", label: "Frame Latency", color: "#F0FDF4" },
            { icon: <BarChart3 size={20} color="#D97706" />, value: "8 Zones", label: "Max Concurrent Zones", color: "#FFFBEB" },
            { icon: <Shield size={20} color="#7C3AED" />, value: "24/7", label: "Continuous Monitoring", color: "#F5F3FF" },
          ].map((s) => (
            <StatsCard key={s.label} {...s} />
          ))}
        </div>

        {/* RTSP Card — secondary */}
        <div className="card animate-slide-up" style={{ padding: "28px", marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Wifi size={20} color="#16A34A" />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>Live CCTV Monitoring</h2>
              <p style={{ fontSize: "0.8125rem", color: "#64748B" }}>Connect to a live camera stream instead</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "flex-start" }}>
            <div>
              <input
                type="url"
                placeholder="rtsp://username:password@camera-ip/stream"
                value={rtspUrl}
                onChange={(e) => { setRtspUrl(e.target.value); setRtspError(""); }}
              />
              {rtspError && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 12px", background: "#FFF1F2", borderRadius: "8px",
                  border: "1px solid #FECDD3", marginTop: "8px",
                }}>
                  <AlertCircle size={14} color="#DC2626" />
                  <span style={{ fontSize: "0.8125rem", color: "#DC2626" }}>{rtspError}</span>
                </div>
              )}
            </div>
            <button
              className="btn-primary"
              style={{
                justifyContent: "center", whiteSpace: "nowrap",
                background: startingRtsp ? "#16A34A" : "linear-gradient(135deg, #16A34A, #22C55E)",
              }}
              onClick={handleRtsp}
              disabled={startingRtsp || !rtspUrl}
            >
              {startingRtsp ? (
                <><Loader2 size={16} className="animate-spin-slow" /> Connecting…</>
              ) : (
                <><Wifi size={16} /> Start Monitoring</>
              )}
            </button>
          </div>

          <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Supported:</span>
            {[
              { label: "RTSP", icon: <Camera size={12} color="#2563EB" /> },
              { label: "HTTP/MJPEG", icon: <Wifi size={12} color="#16A34A" /> },
              { label: "RTMP", icon: <Play size={12} color="#D97706" /> },
              { label: "HLS/m3u8", icon: <Activity size={12} color="#7C3AED" /> },
            ].map((p) => (
              <span key={p.label} style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 10px", background: "#F8FAFC",
                borderRadius: "99px", border: "1px solid #E2E8F0",
                fontSize: "0.75rem", fontWeight: 500, color: "#374151",
              }}>
                {p.icon} {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className="card animate-fade-in" style={{ overflow: "hidden" }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <History size={18} color="#64748B" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A" }}>Recent Sessions</h3>
              <span className="badge badge-gray" style={{ marginLeft: "auto" }}>{sessions.length} sessions</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>File</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 8).map((s) => (
                  <tr key={s.job_id}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "#475569" }}>
                      {s.job_id.slice(0, 8)}…
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.filename}</td>
                    <td>{formatTime(s.created_at)}</td>
                    <td>
                      <span className={`badge ${s.status === "completed" ? "badge-green" : s.status === "failed" ? "badge-red" : "badge-yellow"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {s.status === "completed" && (
                        <button
                          className="btn-secondary"
                          style={{ padding: "4px 12px", fontSize: "0.8125rem" }}
                          onClick={() => router.push(`/dashboard/${s.job_id}`)}
                        >
                          <Eye size={13} /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sessions.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
            <Activity size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>No sessions yet</p>
            <p style={{ fontSize: "0.8125rem" }}>Upload a video or connect to a stream to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
