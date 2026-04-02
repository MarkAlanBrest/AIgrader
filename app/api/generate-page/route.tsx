"use client";

import React, { useState, useEffect } from "react";

type Section = {
  type: string;
  text?: string;
  content?: string;
  items?: string[];
  left?: string;
  right?: string;
  columns?: number;
  style?: string;
};

type PageData = {
  title?: string;
  sections: Section[];
};

export default function PageBuilder() {
  const [input, setInput] = useState("");
  const [content, setContent] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data) return;

      if (event.data.type === "insertPrompt") {
        setInput(event.data.text || "");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function buildPage() {
    if (!input.trim() || !content.trim()) {
      alert("Add both prompt and content");
      return;
    }

    setLoading(true);

    try {
      const finalPrompt = `
${input}

CONTENT TO USE:
${content}

INSTRUCTIONS:
Return ONLY JSON
`;

      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: finalPrompt,
        }),
      });

      if (!res.ok) {
        throw new Error("API request failed");
      }

      const data: PageData = await res.json();

      const finalHTML = buildHTMLFromJSON(data);
      setHtml(finalHTML);
    } catch (err) {
      console.error("BUILD ERROR:", err);
      setHtml("<div style='color:red;'>Error generating page</div>");
    } finally {
      setLoading(false);
    }
  }

  function buildHTMLFromJSON(data: PageData) {
    if (!data || !data.sections) return "<div>No content</div>";

    return `
      <div style="padding:20px;font-family:sans-serif;">
        <h1 style="font-size:28px;margin-bottom:20px;">
          ${data.title || "Generated Page"}
        </h1>

${data.sections
  .map((section) => {
    if (section.type === "heading") {
      return `<h2 style="margin-top:20px;">${section.text || ""}</h2>`;
    }

    if (section.type === "text") {
      return `<p>${section.content || ""}</p>`;
    }

    if (section.type === "list") {
      return `<ul>${(section.items || [])
        .map((i) => `<li>${i}</li>`)
        .join("")}</ul>`;
    }

    if (section.type === "divider") {
      return `<hr style="margin:20px 0;" />`;
    }

    if (section.type === "split") {
      return `
        <div style="display:flex;gap:20px;margin:20px 0;">
          <div style="flex:1;">${section.left || ""}</div>
          <div style="flex:1;">${section.right || ""}</div>
        </div>
      `;
    }

    if (section.type === "grid") {
      const cols = section.columns || 3;
      return `
        <div style="
          display:grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap:16px;
          margin:20px 0;
        ">
          ${(section.items || [])
            .map(
              (item) => `
              <div style="
                padding:12px;
                border:1px solid #ddd;
                border-radius:8px;
              ">
                ${item}
              </div>
            `
            )
            .join("")}
        </div>
      `;
    }

    if (section.type === "callout") {
      let bg = "#eef";

      if (section.style === "warning") bg = "#fff3cd";
      if (section.style === "success") bg = "#d4edda";

      return `
        <div style="
          background:${bg};
          padding:12px;
          border-radius:6px;
          margin:15px 0;
        ">
          ${section.content || ""}
        </div>
      `;
    }

    return "";
  })
  .join("")}
      </div>
    `;
  }

  function copyHTML() {
    if (!html) return;
    navigator.clipboard.writeText(html);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>AI Page Builder</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="AI Prompt"
          style={{ width: "50%", height: "200px" }}
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Teacher Content"
          style={{ width: "50%", height: "200px" }}
        />
      </div>

      <button onClick={buildPage} style={{ marginTop: "10px" }}>
        {loading ? "Building..." : "Build Page"}
      </button>

      <button
        onClick={copyHTML}
        style={{ marginTop: "10px", marginLeft: "10px" }}
      >
        Copy HTML
      </button>

      <div
        style={{ marginTop: "20px" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
