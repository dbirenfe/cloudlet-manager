import { type CSSProperties, useEffect, useState } from "react";
import type { ScopeApps } from "../api/client";
import { fetchApps } from "../api/client";
import AppCard from "./AppCard";

interface AppsPanelProps {
  flavor: string | null;
  env: string | null;
  cluster: string | null;
  onNavigate: (
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => void;
}

const s: Record<string, CSSProperties> = {
  panel: {
    flex: 1,
    padding: 32,
    overflowY: "auto",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--text-muted)",
    marginBottom: 8,
  },
  breadcrumbPart: {
    color: "var(--text-secondary)",
    fontWeight: 500,
    cursor: "pointer",
    borderRadius: 4,
    padding: "2px 6px",
    transition: "background 0.12s, color 0.12s",
  },
  breadcrumbPartActive: {
    color: "var(--text-primary)",
    fontWeight: 600,
  },
  breadcrumbSep: {
    color: "var(--text-muted)",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  scopeType: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent)",
    background: "var(--accent-muted)",
    padding: "2px 10px",
    borderRadius: 6,
    display: "inline-block",
    marginBottom: 20,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  stats: {
    display: "flex",
    gap: 20,
    marginBottom: 24,
  },
  stat: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "12px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
    gap: 16,
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

export default function AppsPanel({ flavor, env, cluster, onNavigate }: AppsPanelProps) {
  const [data, setData] = useState<ScopeApps | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchApps(flavor ?? undefined, env ?? undefined, cluster ?? undefined)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [flavor, env, cluster, refreshKey]);

  const breadcrumbParts: string[] = [];
  if (flavor) breadcrumbParts.push(flavor);
  if (env) breadcrumbParts.push(env);
  if (cluster) breadcrumbParts.push(cluster);

  const displayName = cluster || env || flavor || "All Clusters";
  const warningCount =
    data?.apps.filter((a) => a.branch_exists === false).length ?? 0;

  let scopeFile = "_apps.yaml";
  if (flavor && env && cluster) {
    scopeFile = `${flavor}/${env}/${cluster}.yaml`;
  } else if (flavor && env) {
    scopeFile = `${flavor}/${env}/_apps.yaml`;
  } else if (flavor) {
    scopeFile = `${flavor}/_apps.yaml`;
  }

  return (
    <div style={s.panel}>
      <div style={s.breadcrumb}>
        <span
          style={{ ...s.breadcrumbPart, ...(!flavor ? s.breadcrumbPartActive : {}) }}
          onClick={() => onNavigate(null, null, null)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          root
        </span>
        {flavor && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!env ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(flavor, null, null)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {flavor}
            </span>
          </>
        )}
        {env && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!cluster ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(flavor, env, null)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {env}
            </span>
          </>
        )}
        {cluster && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span style={{ ...s.breadcrumbPart, ...s.breadcrumbPartActive }}>
              {cluster}
            </span>
          </>
        )}
      </div>

      <h1 style={s.heading}>{displayName}</h1>
      {data && <div style={s.scopeType}>{data.scope_type} scope</div>}

      {loading && <div style={s.loading}>Loading apps...</div>}
      {error && <div style={s.error}>{error}</div>}

      {data && !loading && (
        <>
          <div style={s.stats}>
            <div style={s.stat}>
              <span style={s.statValue}>{data.apps.length}</span>
              <span style={s.statLabel}>Apps</span>
            </div>
            <div style={s.stat}>
              <span
                style={{
                  ...s.statValue,
                  color: warningCount > 0 ? "var(--warning)" : "var(--success)",
                }}
              >
                {warningCount}
              </span>
              <span style={s.statLabel}>Missing Branches</span>
            </div>
          </div>

          {data.apps.length === 0 ? (
            <div style={s.empty}>
              No apps defined at this scope level.
              <br />
              <span style={{ fontSize: 13 }}>
                Apps may be inherited from a broader scope.
              </span>
            </div>
          ) : (
            <div style={s.grid}>
              {data.apps.map((app) => (
                <AppCard
                  key={`${app.name}-${app.defined_at}`}
                  app={app}
                  scopeFile={scopeFile}
                  onUpdated={() => setRefreshKey((k) => k + 1)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
