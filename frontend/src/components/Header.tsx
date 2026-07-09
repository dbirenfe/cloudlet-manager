import { type CSSProperties } from "react";

const styles: Record<string, CSSProperties> = {
  header: {
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    padding: "0 32px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(135deg, var(--accent), #a78bfa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  subtitle: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginLeft: 8,
  },
};

export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.logo}>C</div>
        <span style={styles.title}>Cloudlet Manager</span>
        <span style={styles.subtitle}>GitOps Branch Dashboard</span>
      </div>
    </header>
  );
}
