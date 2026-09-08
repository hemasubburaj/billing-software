import React, { useState } from "react";
import { login, register } from "./api.js";

export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login");
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EDE7DA", fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={submit} style={{ background: "#FFFFFF", borderRadius: 12, padding: "32px 30px", width: 340, border: "0.5px solid #E5DDCB" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{mode === "login" ? "Log in" : "Sign up"}</div>
        {mode === "register" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Business name</label>
            <input style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: "0.5px solid #E5DDCB", boxSizing: "border-box" }} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Username</label>
          <input style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: "0.5px solid #E5DDCB", boxSizing: "border-box" }} value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Password</label>
          <input type="password" style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: "0.5px solid #E5DDCB", boxSizing: "border-box" }} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        {error && <div style={{ color: "#A32D2D", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ width: "100%", background: "#D6431F", color: "#FDECE4", border: "none", padding: 12, borderRadius: 8, fontWeight: 700, cursor: "pointer" }} disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        <div style={{ textAlign: "center", fontSize: 12.5, marginTop: 16 }}>
          {mode === "login" ? (
            <>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("register"); }}>Sign up</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); }}>Log in</a></>
          )}
        </div>
      </form>
    </div>
  );
}
