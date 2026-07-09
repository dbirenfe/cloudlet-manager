import { type CSSProperties, useState } from "react";
import type { RepoStructure, ClusterInfo } from "../api/client";

interface SidebarProps {
  structure: RepoStructure | null;
  selectedFlavor: string | null;
  selectedEnv: string | null;
  selectedCluster: string | null;
  onSelect: (
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => void;
}

const s: Record<string, CSSProperties> = {
  sidebar: {
    width: 280,
    minWidth: 280,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    overflowY: "auto",
    padding: "16px 0",
    display: "flex",
    flexDirection: "column",
  },
  section: { marginBottom: 4 },
  rootItem: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-secondary)",
    transition: "all 0.15s",
    borderLeft: "3px solid transparent",
  },
  rootItemActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
  },
  groupLabel: {
    padding: "10px 20px 6px",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  flavorItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px 8px 24px",
    cursor: "pointer",
    fontSize: 14,
    color: "var(--text-secondary)",
    transition: "all 0.15s",
    borderLeft: "3px solid transparent",
  },
  flavorActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
    fontWeight: 500,
  },
  envItem: {
    padding: "6px 20px 6px 40px",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-secondary)",
    transition: "all 0.15s",
    borderLeft: "3px solid transparent",
  },
  envActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
    fontWeight: 500,
  },
  clusterItem: {
    padding: "5px 20px 5px 56px",
    cursor: "pointer",
    fontSize: 12,
    color: "var(--text-muted)",
    transition: "all 0.15s",
    borderLeft: "3px solid transparent",
  },
  clusterActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
    fontWeight: 500,
  },
  chevron: {
    fontSize: 10,
    transition: "transform 0.2s",
    color: "var(--text-muted)",
  },
  badge: {
    fontSize: 10,
    background: "var(--border)",
    color: "var(--text-muted)",
    borderRadius: 10,
    padding: "1px 6px",
    marginLeft: 8,
  },
};

export default function Sidebar({
  structure,
  selectedFlavor,
  selectedEnv,
  selectedCluster,
  onSelect,
}: SidebarProps) {
  const [expandedFlavors, setExpandedFlavors] = useState<Set<string>>(
    new Set()
  );
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());

  if (!structure) {
    return (
      <div style={s.sidebar}>
        <div style={{ ...s.groupLabel, color: "var(--text-muted)" }}>
          Loading...
        </div>
      </div>
    );
  }

  const toggleFlavor = (flavor: string) => {
    setExpandedFlavors((prev) => {
      const next = new Set(prev);
      if (next.has(flavor)) next.delete(flavor);
      else next.add(flavor);
      return next;
    });
  };

  const toggleEnv = (key: string) => {
    setExpandedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isRootSelected =
    !selectedFlavor && !selectedEnv && !selectedCluster;

  return (
    <div style={s.sidebar}>
      <div style={s.section}>
        <div
          style={{
            ...s.rootItem,
            ...(isRootSelected ? s.rootItemActive : {}),
          }}
          onClick={() => onSelect(null, null, null)}
          onMouseEnter={(e) => {
            if (!isRootSelected)
              (e.currentTarget as HTMLElement).style.background =
                "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            if (!isRootSelected)
              (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          All Clusters (Root)
        </div>
      </div>

      <div style={s.groupLabel}>Flavors</div>

      {structure.flavors.map((flavor) => {
        const isExpanded = expandedFlavors.has(flavor);
        const isFlavorSelected =
          selectedFlavor === flavor && !selectedEnv && !selectedCluster;
        const envs = structure.environments[flavor] || [];

        return (
          <div key={flavor} style={s.section}>
            <div
              style={{
                ...s.flavorItem,
                ...(isFlavorSelected ? s.flavorActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!isFlavorSelected)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isFlavorSelected)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
            >
              <span
                onClick={() => {
                  onSelect(flavor, null, null);
                  if (!isExpanded) toggleFlavor(flavor);
                }}
                style={{ flex: 1, cursor: "pointer" }}
              >
                {flavor}
              </span>
              {envs.length > 0 && (
                <span
                  style={{
                    ...s.chevron,
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFlavor(flavor);
                  }}
                >
                  ▶
                </span>
              )}
            </div>

            {isExpanded &&
              envs.map((env) => {
                const envKey = `${flavor}/${env}`;
                const isEnvExpanded = expandedEnvs.has(envKey);
                const isEnvSelected =
                  selectedFlavor === flavor &&
                  selectedEnv === env &&
                  !selectedCluster;
                const clusters: ClusterInfo[] =
                  structure.clusters[envKey] || [];

                return (
                  <div key={envKey}>
                    <div
                      style={{
                        ...s.envItem,
                        ...(isEnvSelected ? s.envActive : {}),
                      }}
                      onMouseEnter={(e) => {
                        if (!isEnvSelected)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isEnvSelected)
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                      }}
                    >
                      <span
                        onClick={() => {
                          onSelect(flavor, env, null);
                          if (!isEnvExpanded) toggleEnv(envKey);
                        }}
                        style={{
                          flex: 1,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {env}
                        <span style={s.badge}>{clusters.length}</span>
                      </span>
                      {clusters.length > 0 && (
                        <span
                          style={{
                            ...s.chevron,
                            transform: isEnvExpanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "inline-block",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEnv(envKey);
                          }}
                        >
                          ▶
                        </span>
                      )}
                    </div>

                    {isEnvExpanded &&
                      clusters.map((cl) => {
                        const isClusterSelected =
                          selectedFlavor === flavor &&
                          selectedEnv === env &&
                          selectedCluster === cl.name;
                        return (
                          <div
                            key={cl.name}
                            style={{
                              ...s.clusterItem,
                              ...(isClusterSelected ? s.clusterActive : {}),
                            }}
                            onClick={() => onSelect(flavor, env, cl.name)}
                            onMouseEnter={(e) => {
                              if (!isClusterSelected)
                                (
                                  e.currentTarget as HTMLElement
                                ).style.background = "var(--bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isClusterSelected)
                                (
                                  e.currentTarget as HTMLElement
                                ).style.background = "transparent";
                            }}
                          >
                            {cl.name}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
