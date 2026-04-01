"use client";

import { useState, useEffect } from "react";

export default function PageBuilder() {

  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [successBuild, setSuccessBuild] = useState(false);
  const [successCopy, setSuccessCopy] = useState(false);
  const [theme, setTheme] = useState("Modern Blue");

  // ✅ NEW TAB STATE
  const [activeTab, setActiveTab] = useState("pages");

  // -----------------------------
  // PRESETS
  // -----------------------------
  const pagePresets = [
    { title: "Lesson Page", text: "Create a structured lesson page with sections, bullets, and summary." },
    { title: "Video Page", text: "Create a lesson page with 2–3 videos and key takeaways." },
    { title: "Step Guide", text: "Create step-by-step instructions with numbered steps and tips." },
    { title: "Career Page", text: "Create a career overview including skills, tools, and training." },
    { title: "Concept Page", text: "Explain a concept simply with examples and key points." },
    { title: "Compare Page", text: "Compare two topics with similarities and differences." },
    { title: "Safety Page", text: "Create safety training content with rules and hazards." },
    { title: "Tools Page", text: "Explain tools, uses, safety, and mistakes." },
    { title: "Process Page", text: "Create a step-by-step process explanation." },
    { title: "FAQ Page", text: "Create a FAQ with 8 questions and answers." }
  ];

  const assignmentPresets = [
    { title: "Research", text: "Create a research assignment with topics, instructions, and rubric." },
    { title: "MC Quiz", text: "Create 10 multiple choice questions with answers." },
    { title: "Short Answer", text: "Create 5–8 short answer questions with answer key." },
    { title: "Reflection", text: "Create a reflection assignment with 4–6 questions." },
    { title: "Project", text: "Create a project assignment with steps and grading rubric." },
    { title: "Scenario", text: "Create a real-world scenario assignment with guiding questions." },
    { title: "Vocabulary", text: "Create a vocabulary assignment with matching section." },
    { title: "Discussion", text: "Create a discussion prompt with follow-up responses." },
    { title: "Checklist", text: "Create a checklist-style assignment with tasks." },
    { title: "Mixed Quiz", text: "Create a mix of MC, short answer, and extended response questions." }
  ];

  // -----------------------------
  // MESSAGE LISTENER (UNCHANGED)
  // -----------------------------
  useEffect(() => {
    function handleMessage(event) {
      if (!event.data) return;

      if (event.data.type === "insertPrompt") {
        setInput(event.data.text);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // -----------------------------
  // BUILD PAGE (UNCHANGED)
  // -----------------------------
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
      setHtml(JSON.stringify(data, null, 2)); // keep safe
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // COPY
  // -----------------------------
  function copyHTML() {
    if (!html) return;
    navigator.clipboard.writeText(html);
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>

      {/* LEFT PANEL */}
      <div
        style={{
          width: 360,
          padding: 16,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <h2>AI Page Builder</h2>

        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{
            padding: 8,
            border: "1px solid #d1d5db",
            borderRadius: 4
          }}
        >
          <option>Modern Blue</option>
          <option>Minimal Gray</option>
          <option>Card Layout</option>
          <option>Hero Banner</option>
          <option>Dark Mode</option>
          <option>Soft Pastel</option>
        </select>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste notes, outline, links..."
          style={{
            flex: 1,
            resize: "none",
            padding: 8,
            border: "1px solid #d1d5db",
            borderRadius: 4
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
          style={{
            padding: 10,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4
          }}
        >
          {loading ? "Building..." : successBuild ? "Done!" : "Build Page"}
        </button>

        <button
          onClick={() => {
            copyHTML();
            setSuccessCopy(true);
            setTimeout(() => setSuccessCopy(false), 1200);
          }}
          style={{
            padding: 10,
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 4
          }}
        >
          {successCopy ? "Copied!" : "Copy HTML Code"}
        </button>
      </div>

      {/* TEMPLATE PANEL */}
      <div
        style={{
          width: 240,
          borderRight: "1px solid #e5e7eb",
          padding: 10,
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{ display: "flex", marginBottom: 10 }}>
          <button
            onClick={() => setActiveTab("pages")}
            style={{
              flex: 1,
              padding: 6,
              background: activeTab === "pages" ? "#2563eb" : "#e5e7eb",
              color: activeTab === "pages" ? "#fff" : "#000",
              border: "none"
            }}
          >
            Pages
          </button>

          <button
            onClick={() => setActiveTab("assignments")}
            style={{
              flex: 1,
              padding: 6,
              background: activeTab === "assignments" ? "#2563eb" : "#e5e7eb",
              color: activeTab === "assignments" ? "#fff" : "#000",
              border: "none"
            }}
          >
            Assignments
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {(activeTab === "pages" ? pagePresets : assignmentPresets).map((p, i) => (
            <button
              key={i}
              onClick={() => setInput(p.text)}
              style={{
                width: "100%",
                marginBottom: 6,
                padding: 8,
                background: "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                textAlign: "left",
                fontSize: 12
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* PREVIEW PANEL */}
      <div
        style={{
          flex: 1,
          padding: 20,
          overflow: "auto",
          background: "#ffffff"
        }}
      >
        <pre>{html}</pre>
      </div>

    </div>
  );
}