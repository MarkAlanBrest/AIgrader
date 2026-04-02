

"use client";

import { useState, useEffect } from "react";

export default function PageBuilder() {

  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [successBuild, setSuccessBuild] = useState(false);
  const [successCopy, setSuccessCopy] = useState(false);

  const [content, setContent] = useState("");

  // ⭐⭐⭐ MESSAGE LISTENER FOR TAMPERMONKEY ⭐⭐⭐
  useEffect(() => {
    function handleMessage(event) {
      if (!event.data) return;

      // When Tampermonkey sends a saved script
      if (event.data.type === "insertPrompt") {
if (event.data.text) {
  setInput(event.data.text);
}        }

      // Optional: if you want the iframe to know about the prompt bank
      if (event.data.type === "promptBank") {
        // setPagePrompts(event.data.pagePrompts);
        // setAssignmentPrompts(event.data.assignmentPrompts);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  // ⭐⭐⭐ END OF LISTENER ⭐⭐⭐





  // CHUNK 1 ends here — next chunk will include:
  // - HTML builder
  // - Icon system
  // - BuildPage function
  // - UI layout
  /* ---------------------------------------------------
     ICON SYSTEM (SVG for some themes, Emoji for others)
  --------------------------------------------------- */






function buildHTMLFromJSON(data: any) {
  const sections = (data.sections || [])
    .map((s: any) => {

      // -----------------------------
      // BASIC TEXT BLOCKS
      // -----------------------------

      if (s.type === "heading") {
        return `
          <h2 style="
            font-size: 22px;
            font-weight: 600;
            margin-top: 32px;
            margin-bottom: 12px;
          ">
            ${s.text}
          </h2>
        `;
      }

      if (s.type === "headingAccent") {
        return `
          <div style="margin-top: 32px; margin-bottom: 20px;">
            <h2 style="
              font-size: 22px;
              font-weight: 600;
              margin: 0 0 6px 0;
            ">
              ${s.text}
            </h2>
            <div style="
              height: 3px;
              width: 60px;
              background: #2563eb;
              border-radius: 2px;
            "></div>
          </div>
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

      // Rich long-form paragraph
      if (s.type === "richText") {
        return `
          <div style="
            font-size: 17px;
            line-height: 1.75;
            margin-bottom: 22px;
            color: #111;
          ">
            ${s.content}
          </div>
        `;
      }

      // Warm intro paragraph
      if (s.type === "sectionIntro") {
        return `
          <div style="
            font-size: 18px;
            line-height: 1.8;
            margin: 24px 0;
            color: #374151;
          ">
            ${s.content}
          </div>
        `;
      }

      // Standard long body paragraph
      if (s.type === "body") {
        return `
          <p style="
            font-size: 17px;
            line-height: 1.75;
            margin-bottom: 20px;
            color: #111;
          ">
            ${s.text}
          </p>
        `;
      }

      // Reading passage block
      if (s.type === "readingSection") {
        return `
          <div style="
            background: #fafafa;
            border: 1px solid #e5e7eb;
            padding: 24px;
            border-radius: 10px;
            margin: 28px 0;
            font-size: 17px;
            line-height: 1.75;
          ">
            ${s.content}
          </div>
        `;
      }

      // -----------------------------
      // LISTS / VIDEO
      // -----------------------------

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
            ${s.url}
          </div>
        `;
      }

      // -----------------------------
      // BASIC CONTAINERS
      // -----------------------------

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

      // -----------------------------
      // DIVIDERS
      // -----------------------------

      if (s.type === "divider") {
        return `
          <hr style="
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 32px 0;
          " />
        `;
      }

      if (s.type === "dividerFancy") {
        return `
          <div style="
            height: 3px;
            background: linear-gradient(90deg, #2563eb, #7c3aed);
            border-radius: 2px;
            margin: 32px 0;
          "></div>
        `;
      }

      // -----------------------------
      // CALLOUTS
      // -----------------------------

      if (s.type === "callout") {
        const variant = s.variant || "info";
        let bg = "#e0f2fe";
        let border = "#0284c7";

        if (variant === "warning") { bg = "#fef3c7"; border = "#f59e0b"; }
        if (variant === "success") { bg = "#dcfce7"; border = "#16a34a"; }
        if (variant === "tip")     { bg = "#f3e8ff"; border = "#a855f7"; }

        return `
          <div style="
            background: ${bg};
            border-left: 4px solid ${border};
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
          ">
            ${s.text}
          </div>
        `;
      }

      // -----------------------------
      // COLUMNS (2, 3, 4 TILE GRIDS)
      // -----------------------------

      if (s.type === "tiles") {
        const count = s.count || 2; // 2, 3, or 4
        const width = count === 2 ? "1fr 1fr"
                    : count === 3 ? "1fr 1fr 1fr"
                    : "1fr 1fr 1fr 1fr";

        return `
          <div style="
            display: grid;
            grid-template-columns: ${width};
            gap: 20px;
            margin: 20px 0;
          ">
            ${s.items.map((item: string) => `
              <div style="
                background: white;
                border: 1px solid #e5e7eb;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                text-align: center;
              ">
                ${item}
              </div>
            `).join("")}
          </div>
        `;
      }

      // -----------------------------
      // IMAGE FRAME
      // -----------------------------

      if (s.type === "imageFrame") {
        return `
          <div style="
            background: white;
            padding: 10px;
            border-radius: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            width: fit-content;
            margin: 20px auto;
            text-align: center;
          ">
            <img src="${s.url}" style="max-width: 100%; border-radius: 4px;">
            ${
              s.caption
                ? `<div style="margin-top: 8px; font-size: 14px; color: #374151;">
                     ${s.caption}
                   </div>`
                : ""
            }
          </div>
        `;
      }

      // -----------------------------
      // STEP BLOCK
      // -----------------------------

      if (s.type === "step") {
        return `
          <div style="
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
          ">
            <div style="font-weight: 700; margin-bottom: 8px;">
              Step ${s.number}
            </div>
            <div>${s.text}</div>
          </div>
        `;
      }

      // -----------------------------
      // HERO BANNER
      // -----------------------------

      if (s.type === "hero") {
        return `
          <div style="
            background: linear-gradient(90deg, #2563eb, #7c3aed);
            padding: 40px 20px;
            border-radius: 12px;
            color: white;
            text-align: center;
            margin-bottom: 32px;
          ">
            <div style="font-size: 28px; font-weight: 800;">
              ${s.title}
            </div>
            ${
              s.subtitle
                ? `<div style="font-size: 16px; opacity: 0.9; margin-top: 8px;">
                     ${s.subtitle}
                   </div>`
                : ""
            }
          </div>
        `;
      }

      // -----------------------------
      // FILE DOWNLOAD
      // -----------------------------

      if (s.type === "file") {
        const label = s.label || "Download File";
        return `
          <div style="
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
          ">
            <a href="${s.url}" target="_blank" style="
              color: #4338ca;
              font-weight: 600;
              text-decoration: none;
            ">
              📄 ${label}
            </a>
          </div>
        `;
      }

      // -----------------------------
      // QUOTE BLOCK
      // -----------------------------

      if (s.type === "quote") {
        return `
          <div style="
            border-left: 4px solid #2563eb;
            padding-left: 16px;
            margin: 20px 0;
            font-style: italic;
            color: #374151;
          ">
            “${s.text}”
          </div>
        `;
      }

      // -----------------------------
      // SHADOW BOX
      // -----------------------------

      if (s.type === "shadowBox") {
        return `
          <div style="
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            margin: 20px 0;
          ">
            ${s.content}
          </div>
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

<h1 style="font-size:28px;font-weight:700;margin-bottom:20px;">
  ${data.title || "Generated Page"}
</h1>
      ${sections}

    </div>
  `;
}



/* ---------------------------------------------------
   BUILD PAGE — Calls backend with combined prompt + content
--------------------------------------------------- */
async function buildPage() {

  console.log("INPUT:", input);
  console.log("CONTENT:", content);
  // ✅ REQUIRE BOTH BOXES

if (!input || input.length === 0) {
  alert("Add a prompt");
  return;
}

  setLoading(true);

  try {

    // ✅ BUILD FINAL PROMPT (before fetch)
    const finalPrompt = `
${input}

CONTENT TO USE:
${content}

INSTRUCTIONS:
Use the provided content to build the page.
Do NOT ignore the content.
Organize it clearly and format it visually.
`;

    // ✅ SEND TO API
    const res = await fetch("/api/generate-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  text: finalPrompt
})


    });

const data = await res.json();
alert(JSON.stringify(data));

const finalHTML = buildHTMLFromJSON(data);    
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

<p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
  Build your prompt → Add content → Generate page
</p>

      

        {/* INPUT TEXTAREA */}


   {/* AI PROMPT BOX */}
<label style={{ fontSize: 14, fontWeight: 600 }}>
  AI Prompt (from Builder)
</label>

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

{/* CONTENT BOX */}
<label style={{ fontSize: 14, fontWeight: 600 }}>
  Learning Content / Material
</label>

<textarea
  value={content}
  onChange={(e) => setContent(e.target.value)}
  placeholder="Paste lesson material, notes, or text here..."
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
  {/* BUILD BUTTON */}
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

{/* COPY HTML BUTTON */}
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
