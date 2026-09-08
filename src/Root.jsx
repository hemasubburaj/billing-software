import React, { useState } from "react";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { getToken, getUsername, clearSession, apiStorage } from "./api.js";

window.storage = apiStorage;

export default function Root() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
      <div style={{ flex: 1, display: "flex" }}>
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
