import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface JobStatus {
  job_id: string;
  progress: number;
  stage: string;
  stage_index: number;
  logs: string[];
  status: "queued" | "processing" | "completed" | "failed";
  frames_processed: number;
  total_frames: number;
  workers_detected: number;
  eta_seconds: number;
}

export interface PersonAnalytics {
  person_id: number;
  total_time_seconds: number;
  zone_time_seconds: number;
  first_seen_frame: number;
  last_seen_frame: number;
  first_seen_time: string;
  last_seen_time: string;
  zones_visited: string[];
}

export interface ZoneAnalytics {
  zone_id: string;
  zone_name: string;
  total_entries: number;
  total_duration_seconds: number;
  current_occupancy: number;
  peak_occupancy: number;
}

export interface TimeSeriesPoint {
  time: string;
  persons: number;
  helmets: number;
  frame: number;
}

export interface JobResult {
  job_id: string;
  video_filename: string;
  total_frames: number;
  fps: number;
  duration_seconds: number;
  processing_duration_seconds: number;
  total_unique_persons: number;
  avg_presence_time_seconds: number;
  zone_occupancy_time_seconds: number;
  helmet_detection_enabled: boolean;
  helmet_compliance_pct: number | null;
  persons: PersonAnalytics[];
  zones: ZoneAnalytics[];
  time_series: TimeSeriesPoint[];
  completed_at: string;
}

export interface Session {
  job_id: string;
  filename: string;
  created_at: string;
  status: string;
}

export const api = {
  async uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{ job_id: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${API_BASE}/analyze`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return res.data;
  },

  async startRtsp(rtsp_url: string): Promise<{ job_id: string }> {
    const res = await axios.post(`${API_BASE}/analyze/rtsp`, { rtsp_url });
    return res.data;
  },

  async getStatus(job_id: string): Promise<JobStatus> {
    const res = await axios.get(`${API_BASE}/status/${job_id}`);
    return res.data;
  },

  async getResult(job_id: string): Promise<JobResult> {
    const res = await axios.get(`${API_BASE}/result/${job_id}`);
    return res.data;
  },

  getVideoUrl(job_id: string): string {
    return `${API_BASE}/video/${job_id}`;
  },

  async getSessions(): Promise<Session[]> {
    try {
      const res = await axios.get(`${API_BASE}/sessions`);
      return res.data;
    } catch {
      return [];
    }
  },
};

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}
