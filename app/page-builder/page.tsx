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
    const sections = (data.sections || [])
      .map((s: any) => {
        /* -----------------------------
           HEADING
        ----------------------------- */
        if (s.type === "heading") {
          return `<h2>${sanitize(s.text)}</h2>`;
        }

        /* -----------------------------
           TEXT
        ----------------------------- */
        if (s.type === "text") {
          return `<p>${sanitize(s.content)}</p>`;
        }

        /* -----------------------------
           LIST (Canvas-safe)
        ----------------------------- */
        if (s.type === "list") {
          const items = (s.items || []).map((i: string) => `<li>${sanitize(i)}</li>`).join("");
          return `<ul>${items}</ul>`;
        }

        /* -----------------------------
           CALLOUT (Canvas-safe)
        ----------------------------- */
        if (s.type === "callout") {
          const style = sanitize(s.style || "info").toUpperCase();
          return `<div><strong>${style}:</strong> ${sanitize(s.content)}</div>`;
        }

        /* -----------------------------
           DIVIDER
        ----------------------------- */
        if (s.type === "divider") {
          return `<hr />`;
        }

        /* -----------------------------
           GRID → TABLE (Canvas-safe)
        ----------------------------- */
        if (s.type === "grid") {
          const cells = (s.items || [])
            .map((i: string) => `<td>${sanitize(i)}</td>`)
            .join("");

          return `<table><tr>${cells}</tr></table>`;
        }

        return "";
      })
      .join("");

    /* -----------------------------
       FINAL CANVAS-SAFE WRAPPER
    ----------------------------- */
    return `
      <div>
        <h1>${sanitize(data.title || "Generated Page")}</h1>
        ${sections}
      </div>
    `;
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
${input}

CONTENT TO USE:
${content}

INSTRUCTIONS:
Use the provided content to build the page.
Return ONLY JSON.
      `;

      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalPrompt }),
      });

      const data = await res.json();
      const finalHTML = buildHTMLFromJSON(data);
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
