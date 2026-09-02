// Talks to the Express/MongoDB backend. In dev, Vite proxies /api to the
// backend (see vite.config.js); in production, set VITE_API_URL to your
// deployed backend's URL (e.g. https://your-backend.onrender.com).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "").replace(/\/api$/i, "");

const TOKEN_KEY = "spark-billing-token";
const USERNAME_KEY = "spark-billing-username";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUsername() {
  return localStorage.getItem(USERNAME_KEY);
}
export function setSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

async function authedFetch(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (networkErr) {
    console.error(`Network error calling ${path} — is the backend running / VITE_API_URL correct?`, networkErr);
    throw networkErr;
  }
  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("Session expired");
  }
  return res;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  setSession(data.token, data.username);
  return data;
}

export async function register(username, password, businessName) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, businessName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  setSession(data.token, data.username);
  return data;
}

// Implements the same shape as the Claude Artifacts `window.storage` API
// (get/set/delete/list) so App.jsx doesn't need to change.
export const apiStorage = {
  async get(key) {
    const res = await authedFetch(`/api/storage/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Storage get failed");
    return res.json();
  },
  async set(key, value) {
    const res = await authedFetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error("Storage set failed");
    return res.json();
  },
  async delete(key) {
    const res = await authedFetch(`/api/storage/${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Storage delete failed");
    return res.json();
  },
  async list(prefix = "") {
    const res = await authedFetch(`/api/storage?prefix=${encodeURIComponent(prefix)}`);
    if (!res.ok) throw new Error("Storage list failed");
    return res.json();
  },
};
