import React, { useState } from "react";
import { login, register } from "./api.js";

export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, businessName.trim());
      }
      onSuccess();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.dot} />
          <div style={styles.brand}>Sparkline Traders</div>
        </div>
        <div style={styles.subtitle}>{mode === "login" ? "Log in to your billing account" : "Create your billing account"}</div>

        {mode === "register" && (
          <div style={styles.field}>
            <label style={styles.label}>Business name</label>
            <input style={styles.input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Phoenix Crackers" />
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Username</label>
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <div style={styles.switchRow}>
          {mode === "login" ? (
            <>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("register"); setError(""); }}>Sign up</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(""); }}>Log in</a></>
          )}
        </div>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#EDE7DA", fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "#FFFFFF", borderRadius: 12, padding: "32px 30px", width: 340,
    border: "0.5px solid #E5DDCB", boxShadow: "0 12px 32px rgba(33,28,21,0.12)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: "50%", background: "#D6431F" },
  brand: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: "#211C15" },
  subtitle: { fontSize: 12.5, color: "#756B5D", marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#756B5D", marginBottom: 4, fontWeight: 500 },
  input: {
    width: "100%", padding: "9px 11px", borderRadius: 7, border: "0.5px solid #E5DDCB",
    background: "#FBF9F4", fontSize: 13.5, boxSizing: "border-box",
  },
  error: { color: "#A32D2D", fontSize: 12.5, marginBottom: 12 },
  button: {
    width: "100%", background: "#D6431F", color: "#FDECE4", border: "none", padding: 12,
    borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  switchRow: { textAlign: "center", fontSize: 12.5, color: "#756B5D", marginTop: 16 },
};
