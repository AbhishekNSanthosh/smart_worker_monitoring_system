"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { api, JobResult, formatDuration, formatTime } from "@/lib/api";
import {
  Users, Clock, MapPin, Zap, Shield, ChevronRight, Copy,
  CheckCircle, Play, Maximize2, BarChart3, Activity,
  ArrowLeft, Download, Eye, Code2, Table2, ChevronDown, Film
} from "lucide-react";

const PIE_COLORS = ["#2563EB", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

function NavBar({ jobId }: { jobId: string }) {
  const router = useRouter();
  return (
    <nav style={{
      background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
      padding: "0 5vw", height: "64px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "6px",
          background: "linear-gradient(135deg, #2563EB, #3B82F6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Shield size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>Smart Worker Monitor</div>
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500 }}>Analytics Dashboard</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button className="btn-secondary" onClick={() => router.push("/")}>
          <ArrowLeft size={14} /> New Analysis
        </button>
        <div className="badge badge-green">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          Analysis Complete
        </div>
      </div>
    </nav>
  );
}

function StatCard({
  icon, label, value, sub, color, bg
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; bg: string;
}) {
  return (
    <div className="card card-hover" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "6px",
          background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            {label}
          </div>
          <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "4px",
        background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#2563EB" }}>{icon}</div>
      </div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
      {badge && <span className="badge badge-blue" style={{ marginLeft: "auto" }}>{badge}</span>}
    </div>
  );
}

function JsonViewer({ data }: { data: object }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px",
          cursor: "pointer", borderBottom: open ? "1px solid #E2E8F0" : "none",
          background: "#F8FAFC",
        }}
        onClick={() => setOpen(!open)}
      >
        <Code2 size={16} color="#475569" />
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151" }}>JSON Analytics Export</span>
        <span className="badge badge-gray" style={{ marginLeft: "auto" }}>{Object.keys(data).length} fields</span>
        <button
          className="btn-secondary"
          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        >
          {copied ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
        <ChevronDown size={16} color="#94A3B8" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>
      {open && (
        <pre style={{
          margin: 0, padding: "16px 20px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.75rem", lineHeight: 1.7,
          color: "#374151", background: "#FAFAFA",
          maxHeight: "400px", overflowY: "auto",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

// ---- Mock data fallback for demo ----
function getMockResult(jobId: string): JobResult {
  const persons = Array.from({ length: 6 }, (_, i) => ({
    person_id: i + 1,
    total_time_seconds: Math.round(30 + Math.random() * 120),
    zone_time_seconds: Math.round(15 + Math.random() * 80),
    first_seen_frame: Math.round(Math.random() * 100),
    last_seen_frame: Math.round(700 + Math.random() * 200),
    first_seen_time: "00:00:04",
    last_seen_time: "00:04:12",
    zones_visited: ["Zone A", "Zone B", "Zone C"].slice(0, Math.ceil(Math.random() * 3)),
  }));

  const zones = [
    { zone_id: "zone_a", zone_name: "Zone A – Assembly", total_entries: 14, total_duration_seconds: 320, current_occupancy: 2, peak_occupancy: 4 },
    { zone_id: "zone_b", zone_name: "Zone B – Storage", total_entries: 9, total_duration_seconds: 180, current_occupancy: 1, peak_occupancy: 3 },
    { zone_id: "zone_c", zone_name: "Zone C – Exit", total_entries: 22, total_duration_seconds: 95, current_occupancy: 0, peak_occupancy: 2 },
  ];

  const time_series = Array.from({ length: 20 }, (_, i) => {
    const persons = Math.round(1 + Math.random() * 5);
    return {
      time: `${String(Math.floor(i * 15 / 60)).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}`,
      persons,
      helmets: Math.round(persons * (0.6 + Math.random() * 0.4)),
      frame: i * 45,
    };
  });

  return {
    job_id: jobId,
    video_filename: "worker_footage.mp4",
    total_frames: 900,
    fps: 30,
    duration_seconds: 300,
    processing_duration_seconds: 42,
    total_unique_persons: 6,
    avg_presence_time_seconds: 87,
    zone_occupancy_time_seconds: 595,
    helmet_detection_enabled: true,
    helmet_compliance_pct: 83,
    persons,
    zones,
    time_series,
    completed_at: new Date().toISOString(),
  };
}

export default function DashboardPage() {
  const params = useParams();
  const rawJobId = params.jobId;
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : (rawJobId ?? "");
  const [result, setResult] = useState<JobResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    api.getResult(jobId)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(getMockResult(jobId)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "52px", height: "52px", border: "3px solid #E2E8F0",
            borderTopColor: "#2563EB", borderRadius: "50%",
            animation: "spin 1s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ fontWeight: 600, color: "#374151" }}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const videoUrl = `${api.getVideoUrl(jobId)}?v=${encodeURIComponent(result.completed_at)}`;
  const zoneBarData = result.zones.map((z) => ({
    name: z.zone_name.split("–")[0].trim(),
    entries: z.total_entries,
    duration: Math.round(z.total_duration_seconds / 60 * 10) / 10,
    occupancy: z.current_occupancy,
  }));

  const personDurationData = result.persons.map((p) => ({
    name: `P-${p.person_id}`,
    total: Math.round(p.total_time_seconds),
    zone: Math.round(p.zone_time_seconds),
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <NavBar jobId={jobId} />

      <main style={{ padding: "40px 5vw" }}>

        {/* Breadcrumb */}
        <div className="animate-fade-in" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>Analytics</span>
          <ChevronRight size={14} color="#CBD5E1" />
          <span style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>{result.video_filename}</span>
          <ChevronRight size={14} color="#CBD5E1" />
          <span style={{ fontSize: "0.8125rem", color: "#2563EB", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
            {jobId.slice(0, 12)}…
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button
              className="btn-secondary"
              style={{ fontSize: "0.8125rem" }}
              onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `report-${jobId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={13} /> Export Report
            </button>
          </div>
        </div>

        {/* ── Top Stats ── */}
        <div className="animate-slide-up" style={{
          display: "grid",
          gridTemplateColumns: `repeat(${result.helmet_detection_enabled ? 5 : 4}, 1fr)`,
          gap: "16px",
          marginBottom: "28px",
        }}>
          <StatCard icon={<Users size={20} />} label="Unique Persons" value={`${result.total_unique_persons}`}
            sub={`Tracked across ${result.total_frames.toLocaleString()} frames`}
            color="#2563EB" bg="#EFF6FF" />
          <StatCard icon={<Clock size={20} />} label="Avg Presence Time" value={formatDuration(result.avg_presence_time_seconds)}
            sub="Per detected worker"
            color="#16A34A" bg="#F0FDF4" />
          <StatCard icon={<MapPin size={20} />} label="Zone Occupancy" value={formatDuration(result.zone_occupancy_time_seconds)}
            sub={`Across ${result.zones.length} monitored zones`}
            color="#D97706" bg="#FFFBEB" />
          <StatCard icon={<Zap size={20} />} label="Processing Time" value={formatDuration(result.processing_duration_seconds)}
            sub={`${result.fps} FPS · ${formatDuration(result.duration_seconds)} video`}
            color="#7C3AED" bg="#F5F3FF" />
          {result.helmet_detection_enabled && (
            <StatCard
              icon={<Shield size={20} />}
              label="Helmet Compliance"
              value={result.helmet_compliance_pct !== null ? `${result.helmet_compliance_pct}%` : "—"}
              sub="All workers wearing helmets"
              color={result.helmet_compliance_pct !== null && result.helmet_compliance_pct >= 80 ? "#16A34A" : "#DC2626"}
              bg={result.helmet_compliance_pct !== null && result.helmet_compliance_pct >= 80 ? "#F0FDF4" : "#FEF2F2"}
            />
          )}
        </div>

        {/* ── Video Player (full width) ── */}
        <div className="card animate-slide-up" style={{ overflow: "hidden", marginBottom: "24px" }}>
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid #E2E8F0",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <Eye size={16} color="#475569" />
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151" }}>Annotated Video Output</span>
            <span className={`badge ${videoError ? "badge-gray" : "badge-green"}`} style={{ marginLeft: "auto" }}>
              {videoError ? "Unavailable" : "AI Annotated"}
            </span>
          </div>
          <div style={{ background: "#0F172A", position: "relative", aspectRatio: "16/9" }}>
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              muted
              controls
              playsInline
              style={{ width: "100%", height: "100%", display: videoError ? "none" : "block" }}
              onError={() => setVideoError(true)}
              onLoadedData={() => setVideoLoaded(true)}
              poster={`data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect fill='%230F172A' width='16' height='9'/><text x='8' y='4.8' text-anchor='middle' fill='%2364748B' font-size='1.2' font-family='system-ui'>Loading video...</text></svg>`}
            />
            {videoError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
                <Film size={48} color="#475569" style={{ marginBottom: "16px" }} />
                <div style={{ color: "#E2E8F0", fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Video Unavailable (Simulation Mode)</div>
                <div style={{ color: "#94A3B8", fontSize: "0.875rem", maxWidth: "400px", lineHeight: 1.6 }}>
                  You are currently running the backend in Simulation Mode, so no actual video rendering was performed.
                  <br/><br/>
                  To see real annotated videos, install the AI dependencies (<code>pip install -r ai_engine/requirements.txt</code>) and restart the backend.
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "10px 20px", display: "flex", gap: "16px", borderTop: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
              <strong style={{ color: "#374151" }}>{result.total_frames.toLocaleString()}</strong> frames · <strong style={{ color: "#374151" }}>{result.fps} FPS</strong>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", marginLeft: "auto" }}>
              Duration: <strong style={{ color: "#374151" }}>{formatDuration(result.duration_seconds)}</strong>
            </div>
          </div>
        </div>

        {/* ── Zone Analytics (full width) ── */}
        <div className="card animate-slide-up" style={{ padding: "20px", marginBottom: "24px" }}>
          <SectionHeader icon={<MapPin size={16} />} title="Zone Analytics" badge={`${result.zones.length} zones`} />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${result.zones.length}, 1fr)`, gap: "12px" }}>
            {result.zones.map((zone, i) => (
              <div key={zone.zone_id} style={{
                padding: "14px 16px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "4px",
                borderLeft: `3px solid ${PIE_COLORS[i % PIE_COLORS.length]}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{zone.zone_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "1px" }}>{zone.zone_id}</div>
                  </div>
                  <span className={`badge ${zone.current_occupancy > 0 ? "badge-green" : "badge-gray"}`}>
                    {zone.current_occupancy} now
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Entries", value: zone.total_entries },
                    { label: "Duration", value: formatDuration(zone.total_duration_seconds) },
                    { label: "Peak", value: `${zone.peak_occupancy} max` },
                  ].map((m) => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>{m.value}</div>
                      <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Charts Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 360px", gap: "24px", marginBottom: "24px" }}>

          {/* Time vs Persons Area Chart */}
          <div className="card animate-slide-up" style={{ padding: "24px" }}>
            <SectionHeader icon={<Activity size={16} />} title="Workers Over Time" />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={result.time_series}>
                <defs>
                  <linearGradient id="personGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "4px", fontSize: "0.8125rem" }}
                  labelStyle={{ fontWeight: 600, color: "#0F172A" }}
                />
                <Area type="monotone" dataKey="persons" stroke="#2563EB" strokeWidth={2}
                  fill="url(#personGrad)" name="Workers" />
                {result.helmet_detection_enabled && (
                  <Area type="monotone" dataKey="helmets" stroke="#22C55E" strokeWidth={2}
                    fill="url(#helmetGrad)" name="With Helmet" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Zone Duration Bar Chart */}
          <div className="card animate-slide-up" style={{ padding: "24px" }}>
            <SectionHeader icon={<BarChart3 size={16} />} title="Zone Activity" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zoneBarData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "4px", fontSize: "0.8125rem" }}
                />
                <Bar dataKey="entries" fill="#2563EB" name="Entries" radius={[4, 4, 0, 0]} />
                <Bar dataKey="duration" fill="#22C55E" name="Duration (min)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart – Person presence share */}
          <div className="card animate-slide-up" style={{ padding: "24px" }}>
            <SectionHeader icon={<Users size={16} />} title="Presence Share" />
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={personDurationData}
                  dataKey="total"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={75}
                  innerRadius={38}
                  paddingAngle={2}
                >
                  {personDurationData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "4px", fontSize: "0.8125rem" }}
                  formatter={(v: any) => [`${v}s`, "Time"]}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: "0.75rem" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Person Duration Bar Chart ── */}
        <div className="card animate-slide-up" style={{ padding: "24px", marginBottom: "24px" }}>
          <SectionHeader icon={<BarChart3 size={16} />} title="Presence Duration Comparison" badge="Per person" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={personDurationData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} label={{ value: "Seconds", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94A3B8" } }} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "4px", fontSize: "0.8125rem" }}
              />
              <Legend wrapperStyle={{ fontSize: "0.8125rem" }} />
              <Bar dataKey="total" fill="#2563EB" name="Total Time (s)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="zone" fill="#22C55E" name="Zone Time (s)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Person Table ── */}
        <div className="card animate-slide-up" style={{ overflow: "hidden", marginBottom: "24px" }}>
          <div style={{
            padding: "18px 24px", borderBottom: "1px solid #E2E8F0",
            display: "flex", alignItems: "center", gap: "10px", background: "#F8FAFC",
          }}>
            <Table2 size={16} color="#475569" />
            <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#374151" }}>Person Analytics</span>
            <span className="badge badge-blue" style={{ marginLeft: "auto" }}>{result.persons.length} workers</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Person ID</th>
                  <th>Total Time</th>
                  <th>Zone Time</th>
                  <th>Zones Visited</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                  <th style={{ textAlign: "center" }}>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {result.persons.map((p) => {
                  const engagementPct = p.total_time_seconds > 0
                    ? Math.min(100, Math.round((p.zone_time_seconds / p.total_time_seconds) * 100))
                    : 0;
                  return (
                    <tr key={p.person_id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: PIE_COLORS[(p.person_id - 1) % PIE_COLORS.length],
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.75rem", fontWeight: 700, color: "#fff",
                          }}>
                            {p.person_id}
                          </div>
                          <span style={{ fontWeight: 600, color: "#0F172A" }}>Worker #{p.person_id}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatDuration(p.total_time_seconds)}</td>
                      <td>{formatDuration(p.zone_time_seconds)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {p.zones_visited.map((z) => (
                            <span key={z} className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>{z}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8125rem" }}>{p.first_seen_time}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8125rem" }}>{p.last_seen_time}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                          <div style={{ flex: 1, background: "#F1F5F9", borderRadius: "99px", height: "6px", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: "99px",
                              background: engagementPct > 70 ? "#22C55E" : engagementPct > 40 ? "#F59E0B" : "#EF4444",
                              width: `${engagementPct}%`,
                            }} />
                          </div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", minWidth: "32px" }}>
                            {engagementPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── JSON Viewer ── */}
        <div className="animate-slide-up">
          <JsonViewer data={result} />
        </div>
      </main>
    </div>
  );
}
