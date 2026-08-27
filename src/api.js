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
// BACKEND STORAGE
// =========================

async function storageRequest(url, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Storage request failed (${res.status})`);
  }

  return data;
}

// window.storage compatible API
export const apiStorage = {
  async getItem(key) {
    try {
      const data = await storageRequest(
        `/storage/${encodeURIComponent(key)}`
      );

      return data.value;
    } catch (err) {
      if (err.message.includes("404")) {
        return null;
      }

      throw err;
    }
  },

  async setItem(key, value) {
    const data = await storageRequest(
      `/storage/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          value: String(value),
        }),
      }
    );

    return data.value;
  },

  async removeItem(key) {
    return storageRequest(
      `/storage/${encodeURIComponent(key)}`,
      {
        method: "DELETE",
      }
    );
  },

  async clear() {
    const data = await storageRequest("/storage");

    for (const key of data.keys || []) {
      await storageRequest(
        `/storage/${encodeURIComponent(key)}`,
        {
          method: "DELETE",
        }
      );
    }
  },

  async keys(prefix = "") {
    const data = await storageRequest(
      `/storage?prefix=${encodeURIComponent(prefix)}`
    );

    return data.keys || [];
  },
};