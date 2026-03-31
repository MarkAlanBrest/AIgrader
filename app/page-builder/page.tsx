"use client";

import { useState } from "react";

export default function PageBuilder() {
  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("Modern Blue");

  // Unified CSS for all 6 themes
  const allStyles = `
    <style>

    /* ---------------------------------------------------
       GLOBAL BASE STYLES (APPLY TO ALL THEMES)
    --------------------------------------------------- */
    body, .page-root {
      font-family: Arial, sans-serif;
      color: #111;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1.hero-title {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    h2.section-title {
      font-size: 22px;
      font-weight: 600;
      margin-top: 28px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    p {
      font-size: 16px;
      line-height: 1.55;
      margin-bottom: 14px;
    }

    ul.icon-list {
      padding-left: 20px;
      margin-bottom: 16px;
    }

    ul.icon-list li {
      margin-bottom: 6px;
      font-size: 16px;
    }

    hr.divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }

    .container {
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }

    .card {
      padding: 16px;
      border-radius: 10px;
      margin: 16px 0;
    }

    iframe.video-frame {
      width: 100%;
      height: 315px;
      border: none;
      border-radius: 6px;
      margin: 16px 0;
    }

    /* ---------------------------------------------------
       THEME 1 — MODERN BLUE (SVG ICONS)
    --------------------------------------------------- */
    .theme-modern-blue h1.hero-title { color: #2563eb; }
    .theme-modern-blue .section-title svg { fill: #2563eb; width: 20px; }
    .theme-modern-blue .container { background: #eff6ff; border: 1px solid #bfdbfe; }
    .theme-modern-blue .card { background: #dbeafe; border: 1px solid #93c5fd; }

    /* ---------------------------------------------------
       THEME 2 — MINIMAL GRAY (SVG ICONS)
    --------------------------------------------------- */
    .theme-minimal-gray h1.hero-title { color: #374151; }
    .theme-minimal-gray .section-title svg { fill: #6b7280; width: 20px; }
    .theme-minimal-gray .container { background: #f9fafb; border: 1px solid #e5e7eb; }
    .theme-minimal-gray .card { background: #f3f4f6; border: 1px solid #d1d5db; }

    /* ---------------------------------------------------
       THEME 3 — CARD LAYOUT (EMOJI ICONS)
    --------------------------------------------------- */
    .theme-card-layout h1.hero-title { color: #1f2937; }
    .theme-card-layout .container { background: #fef3c7; border: 1px solid #fcd34d; }
    .theme-card-layout .card { background: #fde68a; border: 1px solid #fbbf24; }

    /* ---------------------------------------------------
       THEME 4 — HERO BANNER (SVG ICONS)
    --------------------------------------------------- */
    .theme-hero-banner h1.hero-title {
      background: linear-gradient(90deg, #2563eb, #7c3aed);
      -webkit-background-clip: text;
      color: transparent;
    }
    .theme-hero-banner .section-title svg { fill: #7c3aed; width: 22px; }
    .theme-hero-banner .container { background: #f3e8ff; border: 1px solid #d8b4fe; }
    .theme-hero-banner .card { background: #ede9fe; border: 1px solid #c4b5fd; }

    /* ---------------------------------------------------
       THEME 5 — DARK MODE (SVG ICONS)
    --------------------------------------------------- */
    .theme-dark-mode {
      background: #111827;
      color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
    }
    .theme-dark-mode h1.hero-title { color: #60a5fa; }
    .theme-dark-mode .section-title svg { fill: #93c5fd; width: 20px; }
    .theme-dark-mode .container { background: #1f2937; border: 1px solid #374151; }
    .theme-dark-mode .card { background: #374151; border: 1px solid #4b5563; }

    /* ---------------------------------------------------
       THEME 6 — SOFT PASTEL (EMOJI ICONS)
    --------------------------------------------------- */
    .theme-soft-pastel h1.hero-title { color: #ec4899; }
    .theme-soft-pastel .container { background: #ffe4e6; border: 1px solid #f9a8d4; }
    .theme-soft-pastel .card { background: #fbcfe8; border: 1px solid #f472b6; }

    </style>
  `;

  // CHUNK 1 ends here — next chunk will include:
  // - HTML builder
  // - Icon system
  // - BuildPage function
  // - UI layout
  /* ---------------------------------------------------
     ICON SYSTEM (SVG for some themes, Emoji for others)
  --------------------------------------------------- */
  function getIconForTheme(theme: string) {
    // SVG icons for professional themes
    const svg = `
      <svg viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zm0 7l-10 5 10 5 10-5-10-5zm0 7l-10 5 10 5 10-5-10-5z"/>
      </svg>
    `;

    // Emoji icons for friendly themes
    const emoji = "⭐";

    if (
      theme === "Modern Blue" ||
      theme === "Minimal Gray" ||
      theme === "Hero Banner" ||
      theme === "Dark Mode"
    ) {
      return svg;
    }

    // Card Layout + Soft Pastel
    return emoji;
  }

  /* ---------------------------------------------------
     HTML BUILDER — Converts AI JSON → Styled HTML
  --------------------------------------------------- */

function getTitleContainer(theme: string, title: string) {

  // THEME: Soft Pastel
  if (theme === "Soft Pastel") {
    return `
      <div style="
        background: #ffe4e6;
        border: 1px solid #f9a8d4;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 28px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      ">
        <div style="
          font-size: 30px;
          font-weight: 700;
          color: #ec4899;
        ">
          ${title}
        </div>
      </div>
    `;
  }

  // THEME: Dark Mode
  if (theme === "Dark Mode") {
    return `
      <div style="
        background: #1f2937;
        border: 1px solid #4b5563;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 28px;
        text-align: center;
        color: #f9fafb;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      ">
        <div style="
          font-size: 30px;
          font-weight: 700;
          color: #93c5fd;
        ">
          ${title}
        </div>
      </div>
    `;
  }

  // THEME: Hero Banner (Gradient)
  if (theme === "Hero Banner") {
    return `
      <div style="
        background: #f3e8ff;
        border: 1px solid #d8b4fe;
        padding: 24px;
        border-radius: 14px;
        margin-bottom: 28px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      ">
        <div style="font-size: 42px;">✨</div>
        <div style="
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(90deg, #2563eb, #7c3aed);
          -webkit-background-clip: text;
          color: transparent;
        ">
          ${title}
        </div>
      </div>
    `;
  }

  // THEME: Card Layout (Emoji-forward)
  if (theme === "Card Layout") {
    return `
      <div style="
        background: #fef3c7;
        border: 1px solid #fcd34d;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 28px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      ">
        <div style="
          font-size: 30px;
          font-weight: 700;
          color: #b45309;
        ">
          ${title}
        </div>
      </div>
    `;
  }

  // THEME: Minimal Gray
  if (theme === "Minimal Gray") {
    return `
      <div style="
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 28px;
        text-align: center;
      ">
        <div style="
          font-size: 30px;
          font-weight: 700;
          color: #374151;
        ">
          ${title}
        </div>
      </div>
    `;
  }

  // DEFAULT: Modern Blue
  return `
    <div style="
      background: #f0f7ff;
      border: 1px solid #c7ddff;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 28px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    ">
      <div style="
        font-size: 30px;
        font-weight: 700;
        color: #2563eb;
      ">
        ${title}
      </div>
    </div>
  `;
}



function buildHTMLFromJSON(data: any, theme: string) {

  // Pick emoji icon per theme
  const icon =
    theme === "Card Layout" ? "⭐" :
    theme === "Soft Pastel" ? "🌸" :
    theme === "Dark Mode" ? "💡" :
    theme === "Hero Banner" ? "✨" :
    theme === "Minimal Gray" ? "🔹" :
    "🔵"; // Modern Blue default

  const sections = (data.sections || [])
    .map((s: any) => {

      if (s.type === "heading") {
        return `
          <h2 style="
            font-size: 22px;
            font-weight: 600;
            margin-top: 32px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span style="font-size: 22px;">${icon}</span>
            ${s.text}
          </h2>
        `;
      }

      if (s.type === "text") {
        return `
          <p style="
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 16px;
          ">
            ${s.content}
          </p>
        `;
      }

      if (s.type === "list") {
        return `
          <ul style="
            padding-left: 22px;
            margin-bottom: 20px;
            font-size: 16px;
            line-height: 1.5;
          ">
            ${s.items.map((i: string) => `<li>${i}</li>`).join("")}
          </ul>
        `;
      }

      if (s.type === "video") {
        return `
          <div style="margin: 20px 0;">
            <iframe
              src="${s.url}"
              allowfullscreen
              style="width: 100%; height: 315px; border: none; border-radius: 8px;">
            </iframe>
          </div>
        `;
      }

      if (s.type === "container") {
        return `
          <div style="
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
          ">
            ${s.content}
          </div>
        `;
      }

      if (s.type === "card") {
        return `
          <div style="
            background: #dbeafe;
            border: 1px solid #93c5fd;
            padding: 16px;
            border-radius: 10px;
            margin: 20px 0;
          ">
            ${s.content}
          </div>
        `;
      }

      if (s.type === "divider") {
        return `
          <hr style="
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 32px 0;
          " />
        `;
      }

      return "";
    })
    .join("");

 return `
  <div style="
    font-family: Arial, sans-serif;
    color: #111;
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
  ">

    ${getTitleContainer(theme, data.title || "Generated Page")}

    ${sections}

  </div>
`;







  /* ---------------------------------------------------
     BUILD PAGE — Calls backend with { text, theme }
  --------------------------------------------------- */
  async function buildPage() {
    if (!input.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          theme: theme
        })
      });

      const data = await res.json();

      const finalHTML = buildHTMLFromJSON(data, theme);
      setHtml(finalHTML);
    } finally {
      setLoading(false);
    }
  }
  /* ---------------------------------------------------
     COPY HTML TO CLIPBOARD
  --------------------------------------------------- */
function copyHTML() {
  if (!html) return;

  const ta = document.createElement("textarea");
  ta.value = html;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}



  /* ---------------------------------------------------
     UI LAYOUT
  --------------------------------------------------- */
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: 360,
          padding: 16,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ marginBottom: 4 }}>AI Page Builder</h2>

        {/* THEME SELECTOR */}
        <label style={{ fontSize: 14, fontWeight: 600 }}>Theme</label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{
            padding: 8,
            fontSize: 14,
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        >
          <option>Modern Blue</option>
          <option>Minimal Gray</option>
          <option>Card Layout</option>
          <option>Hero Banner</option>
          <option>Dark Mode</option>
          <option>Soft Pastel</option>
        </select>

        {/* INPUT TEXTAREA */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste notes, outline, links..."
          style={{
            flex: 1,
            resize: "none",
            padding: 8,
            fontSize: 14,
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />

        {/* BUILD BUTTON */}
        <button
          onClick={buildPage}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            borderRadius: 4,
          }}
        >
          {loading ? "Building..." : "Build Page"}
        </button>

        {/* COPY HTML BUTTON */}
        <button
          onClick={copyHTML}
          disabled={!html}
          style={{
            padding: "10px 12px",
            background: "#111827",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            borderRadius: 4,
          }}
        >
          Copy HTML Code
        </button>
      </div>

      {/* RIGHT PREVIEW PANEL */}
      <div
        style={{
          flex: 1,
          padding: 24,
          background: "#ffffff", // Canvas-accurate
          overflow: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: 24,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
