const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://billing-software-wlvw.onrender.com/api";

// =========================
// AUTH
// =========================

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Login failed (${res.status})`);
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);

  return data;
}

export async function register(username, password, businessName) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      businessName,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Registration failed (${res.status})`);
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);

  return data;
}

// =========================
// SESSION
// =========================

export function getToken() {
  return localStorage.getItem("token");
}

export function getUsername() {
  return localStorage.getItem("username") || "";
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
}

// =========================
// STORAGE
// =========================

export const apiStorage = {
  getItem(key) {
    return localStorage.getItem(key);
  },

  setItem(key, value) {
    localStorage.setItem(key, value);
  },

  removeItem(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  },
};