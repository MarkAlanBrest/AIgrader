"use client";

import { useState } from "react";

export default function PageBuilder() {
  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);

  async function buildPage() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      const data = await res.json();

      const content = (data.sections || [])
        .map((s: any) => {
          if (s.type === "heading") return `<h2>${s.text}</h2>`;
          if (s.type === "text") return `<p>${s.content}</p>`;
          if (s.type === "list")
            return `<ul>${s.items
              .map((i: string) => `<li>${i}</li>`)
              .join("")}</ul>`;
          if (s.type === "video")
            return `<iframe width="100%" height="315" src="${s.url}" frameborder="0" allowfullscreen></iframe>`;
          return "";
        })
        .join("");

      setHtml(`
        <div style="font-family:Arial;">
          <h1>${data.title || "Generated Page"}</h1>
          ${content}
        </div>
      `);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      <div
        style={{
          width: 360,
          padding: 16,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h2>AI Page Builder</h2>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste notes, outline, links..."
          style={{ flex: 1, resize: "none", padding: 8, fontSize: 14 }}
        />
        <button
          onClick={buildPage}
          disabled={loading}
          style={{
            padding: "8px 12px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Building..." : "Build Page"}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: 24,
          background: "#f3f4f6",
          overflow: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
