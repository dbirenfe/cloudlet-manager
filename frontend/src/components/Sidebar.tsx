import { type CSSProperties, useState, useEffect, useCallback } from "react";
import type { RepoStructure, ClusterInfo } from "../api/client";

const PINNED_STORAGE_KEY = "cloudlet-pinned-clusters";

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinned(pins: string[]) {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pins));
}

interface SidebarProps {
  structure: RepoStructure | null;
  selectedNetwork: string | null;
  selectedFlavor: string | null;
  selectedEnv: string | null;
  selectedCluster: string | null;
  onSelect: (
    network: string | null,
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} style={{ flexShrink: 0 }}>
      <path
        d="M8 1.5L9.8 5.7L14.3 6.2L11 9.3L11.8 13.8L8 11.6L4.2 13.8L5 9.3L1.7 6.2L6.2 5.7L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
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
  pinBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 2,
    display: "flex",
    alignItems: "center",
    color: "var(--text-muted)",
    transition: "color 0.15s",
    flexShrink: 0,
  },
  pinBtnActive: {
    color: "var(--warning)",
  },
  pinnedCluster: {
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

function NetworkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5V8M8 8L3.5 10.5M8 8L12.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar({
  structure,
  selectedNetwork,
  selectedFlavor,
  selectedEnv,
  selectedCluster,
  onSelect,
}: SidebarProps) {
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [expandedFlavors, setExpandedFlavors] = useState<Set<string>>(new Set());
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<string[]>(loadPinned);

  useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  const togglePin = useCallback((key: string) => {
    setPinned((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  if (!structure) {
    return (
      <div style={st.sidebar}>
        <div style={{ ...st.groupLabel, color: "var(--text-muted)", padding: 20 }}>
          Loading...
        </div>
      </div>
    );
  }

  const toggleNetwork = (network: string) => {
    setExpandedNetworks((prev) => {
      const next = new Set(prev);
      if (next.has(network)) next.delete(network);
      else next.add(network);
      return next;
    });
  };

  const toggleFlavor = (key: string) => {
    setExpandedFlavors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  const isRootSelected = !selectedNetwork && !selectedFlavor && !selectedEnv && !selectedCluster;

  const networks = structure.networks ?? [];
  const hasNetworks = networks.length > 0;

  return (
    <div style={st.sidebar}>
      <div
        style={{
          ...st.rootItem,
          ...(isRootSelected ? st.rootItemActive : {}),
        }}
        onClick={() => onSelect(null, null, null, null)}
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

      {pinned.length > 0 && (
        <>
          <div style={st.groupLabel}>Pinned</div>
          {pinned.map((key) => {
            const parts = key.split("/");
            let pNetwork: string | null = null;
            let pFlavor: string;
            let pEnv: string;
            let pCluster: string;
            if (parts.length >= 4) {
              pNetwork = parts[0];
              pFlavor = parts[1];
              pEnv = parts[2];
              pCluster = parts.slice(3).join("/");
            } else {
              pFlavor = parts[0];
              pEnv = parts[1];
              pCluster = parts.slice(2).join("/");
            }
            const isActive =
              selectedNetwork === pNetwork &&
              selectedFlavor === pFlavor &&
              selectedEnv === pEnv &&
              selectedCluster === pCluster;
            return (
              <div
                key={`pin-${key}`}
                style={{
                  ...st.pinnedCluster,
                  ...(isActive ? st.treeItemActive : {}),
                }}
                onClick={() => onSelect(pNetwork, pFlavor, pEnv, pCluster)}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <ServerIcon />
                <span style={{ flex: 1 }}>{pCluster}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {pNetwork ? `${pNetwork}/` : ""}{pFlavor}/{pEnv}
                </span>
                <button
                  style={{ ...st.pinBtn, ...st.pinBtnActive }}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(key);
                  }}
                  title="Unpin"
                >
                  <StarIcon filled />
                </button>
              </div>
            );
          })}
        </>
      )}

      {hasNetworks && (
        <>
          <div style={st.groupLabel}>Networks</div>

          {networks.map((network) => {
            const isNetworkExpanded = expandedNetworks.has(network);
            const isNetworkSelected =
              selectedNetwork === network && !selectedFlavor && !selectedEnv && !selectedCluster;
            const flavors = (structure.flavors as Record<string, string[]>)[network] || [];

            return (
              <div key={network} style={st.section}>
                <TreeRow
                  active={isNetworkSelected}
                  depth={0}
                  onClick={() => {
                    onSelect(network, null, null, null);
                    if (!isNetworkExpanded) toggleNetwork(network);
                  }}
                >
                  <span
                    style={{ color: "inherit", display: "flex", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNetwork(network);
                    }}
                  >
                    <ChevronIcon expanded={isNetworkExpanded} />
                  </span>
                  <NetworkIcon />
                  <span style={{ flex: 1 }}>{network}</span>
                </TreeRow>

                {isNetworkExpanded &&
                  flavors.map((flavor) => {
                    const flavorKey = `${network}/${flavor}`;
                    const isFlavorExpanded = expandedFlavors.has(flavorKey);
                    const isFlavorSelected =
                      selectedNetwork === network &&
                      selectedFlavor === flavor &&
                      !selectedEnv &&
                      !selectedCluster;
                    const envs = structure.environments[flavorKey] || [];

                    return (
                      <div key={flavorKey} style={st.section}>
                        <TreeRow
                          active={isFlavorSelected}
                          depth={1}
                          onClick={() => {
                            onSelect(network, flavor, null, null);
                            if (!isFlavorExpanded) toggleFlavor(flavorKey);
                          }}
                        >
                          <span
                            style={{ color: "inherit", display: "flex", cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlavor(flavorKey);
                            }}
                          >
                            <ChevronIcon expanded={isFlavorExpanded} />
                          </span>
                          <FolderIcon />
                          <span style={{ flex: 1 }}>{flavor}</span>
                        </TreeRow>

                        {isFlavorExpanded &&
                          envs.map((env) => {
                            const envKey = `${network}/${flavor}/${env}`;
                            const isEnvExpanded = expandedEnvs.has(envKey);
                            const isEnvSelected =
                              selectedNetwork === network &&
                              selectedFlavor === flavor &&
                              selectedEnv === env &&
                              !selectedCluster;
                            const clusters: ClusterInfo[] = structure.clusters[envKey] || [];

                            return (
                              <div key={envKey}>
                                <TreeRow
                                  active={isEnvSelected}
                                  depth={2}
                                  onClick={() => {
                                    onSelect(network, flavor, env, null);
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
                                      selectedNetwork === network &&
                                      selectedFlavor === flavor &&
                                      selectedEnv === env &&
                                      selectedCluster === cl.name;
                                    const clusterKey = `${network}/${flavor}/${env}/${cl.name}`;
                                    const isPinned = pinned.includes(clusterKey);
                                    return (
                                      <TreeRow
                                        key={cl.name}
                                        active={isClusterSelected}
                                        depth={3}
                                        onClick={() => onSelect(network, flavor, env, cl.name)}
                                      >
                                        <span style={{ width: 16 }} />
                                        <ServerIcon />
                                        <span style={{ flex: 1 }}>{cl.name}</span>
                                        <button
                                          style={{
                                            ...st.pinBtn,
                                            ...(isPinned ? st.pinBtnActive : {}),
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePin(clusterKey);
                                          }}
                                          title={isPinned ? "Unpin" : "Pin"}
                                        >
                                          <StarIcon filled={isPinned} />
                                        </button>
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
          })}
        </>
      )}

      {!hasNetworks && Array.isArray(structure.flavors) && (
        <>
          <div style={st.groupLabel}>Flavors</div>

          {(structure.flavors as unknown as string[]).map((flavor) => {
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
                    onSelect(null, flavor, null, null);
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
                            onSelect(null, flavor, env, null);
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
                            const clusterKey = `${flavor}/${env}/${cl.name}`;
                            const isPinned = pinned.includes(clusterKey);
                            return (
                              <TreeRow
                                key={cl.name}
                                active={isClusterSelected}
                                depth={2}
                                onClick={() => onSelect(null, flavor, env, cl.name)}
                              >
                                <span style={{ width: 16 }} />
                                <ServerIcon />
                                <span style={{ flex: 1 }}>{cl.name}</span>
                                <button
                                  style={{
                                    ...st.pinBtn,
                                    ...(isPinned ? st.pinBtnActive : {}),
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(clusterKey);
                                  }}
                                  title={isPinned ? "Unpin" : "Pin"}
                                >
                                  <StarIcon filled={isPinned} />
                                </button>
                              </TreeRow>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
