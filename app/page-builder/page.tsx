"use client";

import { useState, useEffect } from "react";

export default function PageBuilder() {
  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [successBuild, setSuccessBuild] = useState(false);
  const [successCopy, setSuccessCopy] = useState(false);
  const [content, setContent] = useState("");

  /* ---------------------------------------------------
     MESSAGE LISTENER (TAMPERMONKEY)
  --------------------------------------------------- */
  useEffect(() => {
    function handleMessage(event: any) {
      if (!event.data) return;

      if (event.data.type === "insertPrompt") {
        if (event.data.text) setInput(event.data.text);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /* ---------------------------------------------------
     CANVAS-SAFE SANITIZER
  --------------------------------------------------- */
  function sanitize(text: string) {
    if (!text) return "";
    return text
      .replace(/<\/?[^>]+(>|$)/g, "") // remove ALL HTML tags
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ---------------------------------------------------
     CANVAS-SAFE HTML BUILDER
  --------------------------------------------------- */



function buildHTMLFromJSON(data: any) {
  const clean = (t: string) =>
    (t || "")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /* -----------------------------------------
     THEME PALETTE
  ----------------------------------------- */
  const themes = {
    blue: {
      banner: "#2563eb",
      divider: "#e5e7eb",
      info: "#e0f2fe",
      success: "#d1fae5",
      warning: "#fff3cd",
      cardBorder: "#e5e7eb"
    },
    green: {
      banner: "#059669",
      divider: "#bbf7d0",
      info: "#d1fae5",
      success: "#bbf7d0",
      warning: "#fef9c3",
      cardBorder: "#bbf7d0"
    },
    purple: {
      banner: "#7c3aed",
      divider: "#e9d5ff",
      info: "#ede9fe",
      success: "#f3e8ff",
      warning: "#fef9c3",
      cardBorder: "#e9d5ff"
    },
    orange: {
      banner: "#ea580c",
      divider: "#fed7aa",
      info: "#ffedd5",
      success: "#fde68a",
      warning: "#fff7ed",
      cardBorder: "#fed7aa"
    },
    slate: {
      banner: "#475569",
      divider: "#cbd5e1",
      info: "#e2e8f0",
      success: "#cbd5e1",
      warning: "#f1f5f9",
      cardBorder: "#cbd5e1"
    },
    dark: {
      banner: "#111827",
      divider: "#374151",
      info: "#1f2937",
      success: "#374151",
      warning: "#4b5563",
      cardBorder: "#374151"
    }
  };

  const themeName = data.theme || "blue";
  const theme = themes[themeName] || themes.blue;

  let html = "";

  /* -----------------------------------------
     TITLE BANNER
  ----------------------------------------- */
  html += `
    <table style="width:100%;background:${theme.banner};color:white;padding:24px;border-radius:6px;margin-bottom:24px;">
      <tr><td>
        <h1 style="margin:0;font-size:28px;">${clean(data.title || "Generated Page")}</h1>
      </td></tr>
    </table>
  `;

  /* -----------------------------------------
     SECTIONS
  ----------------------------------------- */
  for (const s of data.sections || []) {
    /* HEADING */
    if (s.type === "heading") {
      html += `
        <h2 style="margin-top:24px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid ${theme.divider};">
          ${clean(s.text)}
        </h2>
      `;
    }

    /* TEXT */
    if (s.type === "text") {
      html += `
        <p style="font-size:16px;line-height:1.6;margin:12px 0;">
          ${clean(s.content)}
        </p>
      `;
    }

    /* LIST */
    if (s.type === "list") {
      const items = (s.items || [])
        .map((i: string) => `<li style="margin:6px 0;">${clean(i)}</li>`)
        .join("");

      html += `
        <ul style="margin:12px 0 12px 20px;font-size:16px;line-height:1.6;">
          ${items}
        </ul>
      `;
    }

    /* CALLOUT */
    if (s.type === "callout") {
      const bg =
        s.style === "warning"
          ? theme.warning
          : s.style === "success"
          ? theme.success
          : theme.info;

      html += `
        <table style="width:100%;background:${bg};padding:16px;border-radius:6px;margin:20px 0;">
          <tr><td style="font-size:16px;line-height:1.6;">
            💡 ${clean(s.content)}
          </td></tr>
        </table>
      `;
    }

    /* DIVIDER */
    if (s.type === "divider") {
      html += `<hr style="margin:32px 0;border:0;border-top:1px solid ${theme.divider};">`;
    }

    /* GRID → CARDS */
    if (s.type === "grid") {
      const colWidth = 100 / (s.columns || 3);

      html += `<table style="width:100%;margin:20px 0;"><tr>`;

      for (const item of s.items || []) {
        html += `
          <td style="width:${colWidth}%;padding:10px;vertical-align:top;">
            <table style="width:100%;border:1px solid ${theme.cardBorder};padding:16px;border-radius:6px;">
              <tr><td style="font-size:16px;line-height:1.6;">
                ${clean(item)}
              </td></tr>
            </table>
          </td>
        `;
      }

      html += `</tr></table>`;
    }
  }

  return `<div style="font-family:Arial, sans-serif;">${html}</div>`;
}



function buildAssignmentHTMLFromJSON(data: any) {
  const clean = (t: string) =>
    (t || "")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();

  let html = "";

  html += `<div style="font-family:Arial, sans-serif; max-width:900px; margin:auto;">`;

  html += `<h1 style="margin-bottom:16px;">${clean(data.title)}</h1>`;

  for (const s of data.sections || []) {
    if (s.type === "heading") {
      html += `<h2 style="margin-top:20px;">${clean(s.text)}</h2>`;
    }

    if (s.type === "text") {
      html += `<p style="margin:10px 0;">${clean(s.content)}</p>`;
    }

    if (s.type === "list") {
      const items = (s.items || [])
        .map((i: string) => `<li>${clean(i)}</li>`)
        .join("");

      html += `<ul style="margin-left:20px;">${items}</ul>`;
    }

    if (s.type === "grid") {
      const items = (s.items || [])
        .map((i: string) => `<li>${clean(i)}</li>`)
        .join("");

      html += `<ul style="margin-left:20px;">${items}</ul>`;
    }
  }

  html += `</div>`;

  return html;
}




  /* ---------------------------------------------------
     BUILD PAGE (CALL BACKEND)
  --------------------------------------------------- */
  async function buildPage() {
    if (!input) {
      alert("Add a prompt");
      return;
    }

    setLoading(true);

    try {



const finalPrompt = `
You MUST use ALL of the information in REQUIRED_CONTENT.
Do NOT skip steps. Do NOT remove instructions.
You may rewrite the text in clearer language, but the meaning and intent must stay the same.

JSON_TEMPLATE:
${input}

REQUIRED_CONTENT:
${content}

Return ONLY valid JSON.
`;

const res = await fetch("/api/generate-page", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: finalPrompt }),
});

const data = await res.json();

const isAssignment = input.includes("Canvas assignment");

const finalHTML = isAssignment
  ? buildAssignmentHTMLFromJSON(data)
  : buildHTMLFromJSON(data);

setHtml(finalHTML);

} finally {
  setLoading(false);
}
  }

  /* ---------------------------------------------------
     COPY HTML
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
        <h2>AI Page Builder</h2>

        <label style={{ fontSize: 14, fontWeight: 600 }}>AI Prompt</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your AI prompt will appear here..."
          style={{
            height: 120,
            resize: "none",
            padding: 8,
            fontSize: 14,
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />

        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Learning Content / Material
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste lesson material here..."
          style={{
            flex: 1,
            resize: "none",
            padding: 8,
            fontSize: 14,
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />

        <button
          onClick={async () => {
            setLoading(true);
            await buildPage();
            setLoading(false);
            setSuccessBuild(true);
            setTimeout(() => setSuccessBuild(false), 1200);
          }}
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
          {loading ? "Building..." : successBuild ? "Done!" : "Build Page"}
        </button>

        <button
          onClick={async () => {
            await copyHTML();
            setSuccessCopy(true);
            setTimeout(() => setSuccessCopy(false), 1200);
          }}
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
          {successCopy ? "Copied!" : "Copy HTML Code"}
        </button>
      </div>

      {/* RIGHT PREVIEW */}
      <div
        style={{
          flex: 1,
          padding: 24,
          background: "#ffffff",
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
