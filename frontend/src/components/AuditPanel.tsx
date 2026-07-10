import { type CSSProperties, useEffect, useState } from "react";
import type { AuditEntry } from "../api/client";
import { fetchAuditLog } from "../api/client";

const s: Record<string, CSSProperties> = {
  panel: {
    flex: 1,
    padding: 32,
    overflowY: "auto",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
    marginBottom: 24,
  },
  timeline: {
    position: "relative",
    paddingLeft: 28,
  },
  timelineLine: {
    position: "absolute",
    left: 7,
    top: 8,
    bottom: 0,
    width: 2,
    background: "var(--border)",
    borderRadius: 1,
  },
  entry: {
    position: "relative",
    marginBottom: 20,
    padding: "14px 18px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    transition: "border-color 0.15s",
  },
  dot: {
    position: "absolute",
    left: -24,
    top: 18,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "2px solid var(--bg-primary)",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  author: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  time: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginLeft: "auto",
  },
  message: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: 8,
  },
  files: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  fileChip: {
    fontSize: 11,
    fontFamily: "monospace",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "3px 8px",
    color: "var(--text-secondary)",
  },
  sha: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "var(--accent)",
    textDecoration: "none",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    color: "var(--text-muted)",
    fontSize: 14,
  },
  error: {
    background: "var(--danger-bg)",
    color: "var(--danger)",
    padding: 16,
    borderRadius: "var(--radius)",
    fontSize: 14,
  },
  empty: {
    textAlign: "center" as const,
    padding: 60,
    color: "var(--text-muted)",
    fontSize: 15,
  },
};

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAuditLog(50)
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={s.panel}>
      <h1 style={s.heading}>Audit Log</h1>
      <p style={s.subtitle}>Recent changes to the GitOps configuration</p>

      {loading && <div style={s.loading}>Loading audit log...</div>}
      {error && <div style={s.error}>{error}</div>}

      {!loading && !error && entries.length === 0 && (
        <div style={s.empty}>No audit entries found.</div>
      )}

      {!loading && entries.length > 0 && (
        <div style={s.timeline}>
          <div style={s.timelineLine} />
          {entries.map((entry) => (
            <div key={entry.sha} style={s.entry}>
              <div style={s.dot} />
              <div style={s.entryHeader}>
                <span style={s.author}>{entry.author}</span>
                <a
                  href={`#commit-${entry.sha}`}
                  style={s.sha}
                  title={entry.sha}
                >
                  {entry.sha.slice(0, 7)}
                </a>
                <span style={s.time}>{timeAgo(entry.timestamp)}</span>
              </div>
              <div style={s.message}>{entry.message}</div>
              {entry.files_changed.length > 0 && (
                <div style={s.files}>
                  {entry.files_changed.map((f) => (
                    <span key={f} style={s.fileChip}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
