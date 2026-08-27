// Run this once from your project root: node fix-responsive.mjs
// It patches src/App.jsx to fix the mobile/tablet layout — converts a few
// fragile inline grid styles to CSS classes and adds responsive media
// queries. Safe to re-run (it skips anything already patched).

import fs from "fs";

const path = "src/App.jsx";
let content = fs.readFileSync(path, "utf8");
let changed = false;

const replacements = [
  ['<div className="cardrow" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>', '<div className="cardrow cardrow-5">'],
  ['<div className="cardrow" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>', '<div className="cardrow cardrow-3">'],
  ['<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>', '<div className="split-two">'],
  ['<div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>', '<div className="split-main">'],
  ['<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>', '<div className="split-two-14">'],
];

for (const [oldStr, newStr] of replacements) {
  if (content.includes(oldStr)) {
    content = content.split(oldStr).join(newStr);
    changed = true;
  }
}

const marker = "/* Layout helper classes";
if (!content.includes(marker)) {
  const cssToAdd = `
/* Layout helper classes (replace fragile inline grid-template-columns) */
.cardrow-5 { grid-template-columns: repeat(5, 1fr); }
.cardrow-3 { grid-template-columns: repeat(3, 1fr); }
.split-main { display:grid; grid-template-columns: 1.3fr 1fr; gap:18px; }
.split-two { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
.split-two-14 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }

/* ===== Responsive: tablet & mobile ===== */
@media (max-width: 900px) {
  .app-root { flex-direction: column; min-height: auto; }
  .sidebar {
    width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center;
    padding: 12px; gap: 6px; position: sticky; top: 0; z-index: 10;
  }
  .brand-row { width: 100%; padding: 0 4px 10px; }
  .navbtn { width: auto; flex: 1 1 auto; justify-content: center; font-size: 11.5px; padding: 8px 8px; }
  .main { padding: 16px; }
  .topbar { flex-wrap: wrap; gap: 8px; }
  .cardrow, .cardrow-5, .cardrow-3 { grid-template-columns: repeat(2, 1fr) !important; }
  .split-main, .split-two, .split-two-14, .formgrid {
    grid-template-columns: 1fr !important;
  }
  table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
  .estimate { width: 100%; padding: 22px 16px; }
  .modal-backdrop { padding: 10px; }
  .prodlist { max-height: 240px; }
  .est-parties { grid-template-columns: 1fr !important; gap: 12px; }
}

@media (max-width: 520px) {
  .cardrow, .cardrow-5, .cardrow-3 { grid-template-columns: 1fr !important; }
  .segrow { flex-direction: column; }
  .metric .value { font-size: 18px; }
  .est-orderbar { flex-direction: column; gap: 4px; align-items: flex-start; }
  .navbtn { font-size: 11px; padding: 7px; }
}
`;

  const anchor = '.emptystate { text-align:center; padding: 30px 10px; color: var(--ink-soft); font-size:13px; }';
  if (content.includes(anchor)) {
    content = content.replace(anchor, anchor + "\n" + cssToAdd.trim() + "\n");
    changed = true;
  } else {
    console.warn("Could not find CSS anchor point — please share your App.jsx so I can adjust the script.");
  }
}

if (changed) {
  fs.writeFileSync(path, content, "utf8");
  console.log("✔ Patched src/App.jsx for responsive mobile/tablet layout.");
} else {
  console.log("Nothing to change — file may already be patched.");
}
