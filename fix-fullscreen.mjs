// Run from project root:
// node fix-fullscreen.mjs

import fs from "fs";

let changed = false;

// ============================================================
// 1. src/index.css
// ============================================================

const cssPath = "src/index.css";

const globalCss = `
html,
body,
#root {
  margin: 0;
  width: 100%;
  min-width: 100%;
  min-height: 100%;
}

html,
body {
  background: #EDE7DA;
  font-family: 'Inter', sans-serif;
}

* {
  box-sizing: border-box;
}
`;

if (fs.existsSync(cssPath)) {
  let current = fs.readFileSync(cssPath, "utf8");

  // Don't overwrite existing CSS.
  // Add the fullscreen rules only if they are not already present.
  if (!current.includes("/* FULLSCREEN GLOBAL FIX */")) {
    current += "\n/* FULLSCREEN GLOBAL FIX */\n" + globalCss;
    fs.writeFileSync(cssPath, current, "utf8");
    changed = true;
    console.log("✔ Patched src/index.css");
  } else {
    console.log("src/index.css: fullscreen rules already present.");
  }
} else {
  fs.writeFileSync(
    cssPath,
    `/* FULLSCREEN GLOBAL FIX */\n${globalCss}`,
    "utf8"
  );

  changed = true;
  console.log("✔ Created src/index.css");
}

// ============================================================
// 2. src/App.jsx
// ============================================================

const appPath = "src/App.jsx";

if (fs.existsSync(appPath)) {
  let content = fs.readFileSync(appPath, "utf8");
  let appChanged = false;

  // ----------------------------------------------------------
  // App root
  // ----------------------------------------------------------

  const oldAppRoot =
    "display: flex; min-height: 640px; width: 100%; max-width: 1400px; border-radius: 12px; overflow: hidden; border: 0.5px solid var(--line); box-shadow: 0 12px 32px rgba(33,28,21,0.12);";

  const newAppRoot =
    "display: flex; width: 100%; min-width: 100%; height: 100%; min-height: 0; box-sizing: border-box; overflow: hidden;";

  if (content.includes(oldAppRoot)) {
    content = content.replace(oldAppRoot, newAppRoot);
    appChanged = true;
    console.log("✔ Removed centered card layout");
  }

  // If previous script already changed min-height to 100vh,
  // make it a proper flex-fill layout.
  const previousAppRoot =
    "display: flex; min-height: 100vh; width: 100%; box-sizing: border-box;";

  if (content.includes(previousAppRoot)) {
    content = content.replace(previousAppRoot, newAppRoot);
    appChanged = true;
    console.log("✔ Updated existing fullscreen App root");
  }

  // ----------------------------------------------------------
  // Sidebar
  // ----------------------------------------------------------

  const oldSidebar =
    ".sidebar { width: 208px; background: var(--sidebar); color: var(--sidebar-soft); padding: 20px 14px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }";

  const newSidebar =
    ".sidebar { width: 230px; min-width: 230px; height: 100%; min-height: 0; background: var(--sidebar); color: var(--sidebar-soft); padding: 20px 14px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; overflow-y: auto; }";

  if (content.includes(oldSidebar)) {
    content = content.replace(oldSidebar, newSidebar);
    appChanged = true;
    console.log("✔ Updated desktop sidebar");
  }

  // Previous sticky sidebar version
  const previousSidebar =
    ".sidebar { width: 208px; background: var(--sidebar); color: var(--sidebar-soft); padding: 20px 14px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }";

  if (content.includes(previousSidebar)) {
    content = content.replace(previousSidebar, newSidebar);
    appChanged = true;
    console.log("✔ Updated previous sidebar patch");
  }

  // ----------------------------------------------------------
  // Main content
  // ----------------------------------------------------------

  const oldMain =
    ".main { flex: 1; padding: 24px 28px; overflow-y: auto; }";

  const newMain =
    ".main { flex: 1; width: 100%; min-width: 0; height: 100%; min-height: 0; padding: 32px 36px; overflow-y: auto; overflow-x: hidden; }";

  if (content.includes(oldMain)) {
    content = content.replace(oldMain, newMain);
    appChanged = true;
    console.log("✔ Updated main content");
  }

  // Previous main patch
  const previousMain =
    ".main { flex: 1; padding: 24px 28px; overflow-y: auto; }";

  if (content.includes(previousMain)) {
    content = content.replace(previousMain, newMain);
    appChanged = true;
  }

  // ----------------------------------------------------------
  // Mobile sidebar
  // ----------------------------------------------------------

  const oldMobileSidebar = `  .sidebar {
    width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center;
    padding: 12px; gap: 6px; position: sticky; top: 0; z-index: 10;
  }`;

  const newMobileSidebar = `  .sidebar {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    padding: 12px;
    gap: 6px;
    position: sticky;
    top: 0;
    z-index: 10;
  }`;

  if (content.includes(oldMobileSidebar)) {
    content = content.replace(oldMobileSidebar, newMobileSidebar);
    appChanged = true;
    console.log("✔ Updated mobile sidebar");
  }

  // ----------------------------------------------------------
  // Make app root responsive correctly
  // ----------------------------------------------------------

  const oldMobileRoot =
    ".app-root { flex-direction: column; min-height: auto; }";

  const newMobileRoot =
    ".app-root { flex-direction: column; width: 100%; min-width: 100%; height: auto; min-height: auto; overflow: visible; }";

  if (content.includes(oldMobileRoot)) {
    content = content.replace(oldMobileRoot, newMobileRoot);
    appChanged = true;
    console.log("✔ Updated mobile App root");
  }

  if (appChanged) {
    fs.writeFileSync(appPath, content, "utf8");
    changed = true;
    console.log("✔ Patched src/App.jsx");
  } else {
    console.log("src/App.jsx: no matching layout found.");
  }
} else {
  console.log("⚠ src/App.jsx not found.");
}

// ============================================================
// 3. src/Root.jsx
// ============================================================

const rootPath = "src/Root.jsx";

if (fs.existsSync(rootPath)) {
  let content = fs.readFileSync(rootPath, "utf8");
  let rootChanged = false;

  // ----------------------------------------------------------
  // Existing Root return
  // ----------------------------------------------------------

  const oldReturn = `  return (
    <div>
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
      <App />
    </div>
  );`;

  const newReturn = `  return (
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
  );`;

  if (content.includes(oldReturn)) {
    content = content.replace(oldReturn, newReturn);
    rootChanged = true;
    console.log("✔ Updated Root layout");
  }

  // ----------------------------------------------------------
  // Previous Root layout
  // ----------------------------------------------------------

  const previousReturn = `  return (
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
  );`;

  if (content.includes(previousReturn)) {
    content = content.replace(previousReturn, newReturn);
    rootChanged = true;
    console.log("✔ Updated previous Root patch");
  }

  // ----------------------------------------------------------
  // Top bar
  // ----------------------------------------------------------

  const oldTopBarStyle = `const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  maxWidth: 1400,
  margin: "0 auto 10px",
  padding: "0 4px",
  fontSize: 12.5,
  color: "#756B5D",
  fontFamily: "'Inter', sans-serif",
};`;

  const newTopBarStyle = `const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  minHeight: 46,
  flexShrink: 0,
  boxSizing: "border-box",
  padding: "10px 20px",
  fontSize: 12.5,
  color: "#F1E9D8",
  background: "#211C15",
  fontFamily: "'Inter', sans-serif",
};`;

  if (content.includes(oldTopBarStyle)) {
    content = content.replace(oldTopBarStyle, newTopBarStyle);
    rootChanged = true;
    console.log("✔ Updated top bar");
  }

  if (rootChanged) {
    fs.writeFileSync(rootPath, content, "utf8");
    changed = true;
    console.log("✔ Patched src/Root.jsx");
  } else {
    console.log("src/Root.jsx: no matching layout found.");
  }
} else {
  console.log("⚠ src/Root.jsx not found.");
}

// ============================================================
// DONE
// ============================================================

if (changed) {
  console.log(`
==================================================
FULL-SCREEN PATCH COMPLETED ✔
==================================================

Now restart your development server:

  npm run dev

Then open the localhost URL again.

The app will now:
✔ Use the full browser width
✔ Use the full browser height
✔ Remove the centered 1400px card
✔ Remove outer rounded corners
✔ Remove outer shadow
✔ Keep sidebar full height
✔ Make main content fill remaining space
✔ Keep mobile responsive
✔ Preserve existing application functionality
`);
} else {
  console.log(`
==================================================
NOTHING CHANGED
==================================================

The fullscreen layout may already be patched,
or your project structure is different from the
expected files.

Check:
  src/App.jsx
  src/Root.jsx
  src/index.css
`);
}