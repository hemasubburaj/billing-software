import React, { useState } from "react";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { getToken, getUsername, clearSession, apiStorage } from "./api.js";

// Wire window.storage to the backend-backed implementation so App.jsx
// (which was written for Claude Artifacts) works unchanged.
window.storage = apiStorage;

export default function Root() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={topBarStyle}>
        <span>Logged in as <strong>{getUsername()}</strong></span>

        <button
          style={logoutBtnStyle}
          onClick={() => {
            clearSession();
            setLoggedIn(false);
          }}
        >
          Log out
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <App />
      </div>
    </div>
  );
}

const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 20px",
  fontSize: 12.5,
  color: "#F1E9D8",
  background: "#211C15",
  fontFamily: "'Inter', sans-serif",
};

const logoutBtnStyle = {
  background: "transparent",
  border: "0.5px solid #4A4238",
  borderRadius: 7,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
  color: "#F1E9D8",
};
export const apiStorage = {
  getItem(key) {
    const data = localStorage.getItem(key);
    return data;
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