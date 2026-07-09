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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transition: "transform 0.2s ease",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43679 3 6.69114 3.10536 6.87868 3.29289L7.70711 4.12132C7.89464 4.30886 8.149 4.41421 8.41421 4.41421H13C13.5523 4.41421 14 4.86193 14 5.41421V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="4.5" r="0.75" fill="currentColor" />
      <circle cx="5" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 8H14" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 2C9.65685 3.51472 10.6569 5.66228 10.6569 8C10.6569 10.3377 9.65685 12.4853 8 14C6.34315 12.4853 5.34315 10.3377 5.34315 8C5.34315 5.66228 6.34315 3.51472 8 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

const st: Record<string, CSSProperties> = {
  sidebar: {
    width: 280,
    minWidth: 280,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    overflowY: "auto",
    padding: "12px 0",
    display: "flex",
    flexDirection: "column",
  },
  section: { marginBottom: 2 },
  rootItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-secondary)",
    transition: "all 0.15s",
    borderLeft: "3px solid transparent",
    userSelect: "none" as const,
  },
  rootItemActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
  },
  groupLabel: {
    padding: "14px 16px 6px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--text-muted)",
  },
  treeItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 16px",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-secondary)",
    transition: "all 0.12s",
    borderLeft: "3px solid transparent",
    userSelect: "none" as const,
  },
  treeItemActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    borderLeftColor: "var(--accent)",
    fontWeight: 500,
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    background: "var(--border)",
    color: "var(--text-muted)",
    borderRadius: 10,
    padding: "1px 7px",
    marginLeft: "auto",
  },
};

function TreeRow({
  active,
  depth,
  children,
  onClick,
}: {
  active: boolean;
  depth: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const paddingLeft = 16 + depth * 16;
  return (
    <div
      style={{
        ...st.treeItem,
        paddingLeft,
        ...(active ? st.treeItemActive : {}),
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {children}
    </div>
  );
}

export default function Sidebar({
  structure,
  selectedFlavor,
  selectedEnv,
  selectedCluster,
  onSelect,
}: SidebarProps) {
  const [expandedFlavors, setExpandedFlavors] = useState<Set<string>>(new Set());
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());

  if (!structure) {
    return (
      <div style={st.sidebar}>
        <div style={{ ...st.groupLabel, color: "var(--text-muted)", padding: 20 }}>
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

  const isRootSelected = !selectedFlavor && !selectedEnv && !selectedCluster;

  return (
    <div style={st.sidebar}>
      <div
        style={{
          ...st.rootItem,
          ...(isRootSelected ? st.rootItemActive : {}),
        }}
        onClick={() => onSelect(null, null, null)}
        onMouseEnter={(e) => {
          if (!isRootSelected)
            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isRootSelected)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <GlobeIcon />
        All Clusters
      </div>

      <div style={st.groupLabel}>Flavors</div>

      {structure.flavors.map((flavor) => {
        const isExpanded = expandedFlavors.has(flavor);
        const isFlavorSelected =
          selectedFlavor === flavor && !selectedEnv && !selectedCluster;
        const envs = structure.environments[flavor] || [];

        return (
          <div key={flavor} style={st.section}>
            <TreeRow
              active={isFlavorSelected}
              depth={0}
              onClick={() => {
                onSelect(flavor, null, null);
                if (!isExpanded) toggleFlavor(flavor);
              }}
            >
              <span
                style={{ color: "inherit", display: "flex", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFlavor(flavor);
                }}
              >
                <ChevronIcon expanded={isExpanded} />
              </span>
              <FolderIcon />
              <span style={{ flex: 1 }}>{flavor}</span>
            </TreeRow>

            {isExpanded &&
              envs.map((env) => {
                const envKey = `${flavor}/${env}`;
                const isEnvExpanded = expandedEnvs.has(envKey);
                const isEnvSelected =
                  selectedFlavor === flavor && selectedEnv === env && !selectedCluster;
                const clusters: ClusterInfo[] = structure.clusters[envKey] || [];

                return (
                  <div key={envKey}>
                    <TreeRow
                      active={isEnvSelected}
                      depth={1}
                      onClick={() => {
                        onSelect(flavor, env, null);
                        if (!isEnvExpanded) toggleEnv(envKey);
                      }}
                    >
                      <span
                        style={{ color: "inherit", display: "flex", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEnv(envKey);
                        }}
                      >
                        <ChevronIcon expanded={isEnvExpanded} />
                      </span>
                      <FolderIcon />
                      <span style={{ flex: 1 }}>{env}</span>
                      {clusters.length > 0 && (
                        <span style={st.badge}>{clusters.length}</span>
                      )}
                    </TreeRow>

                    {isEnvExpanded &&
                      clusters.map((cl) => {
                        const isClusterSelected =
                          selectedFlavor === flavor &&
                          selectedEnv === env &&
                          selectedCluster === cl.name;
                        return (
                          <TreeRow
                            key={cl.name}
                            active={isClusterSelected}
                            depth={2}
                            onClick={() => onSelect(flavor, env, cl.name)}
                          >
                            <span style={{ width: 16 }} />
                            <ServerIcon />
                            <span>{cl.name}</span>
                          </TreeRow>
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
