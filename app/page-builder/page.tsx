"use client";

import { useState, useEffect } from "react";

export default function PageBuilder() {

  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [successBuild, setSuccessBuild] = useState(false);
  const [successCopy, setSuccessCopy] = useState(false);
  const [theme, setTheme] = useState("Modern Blue");
  const [activeTab, setActiveTab] = useState("pages");

  // -----------------------------
  // DETAILED PRESETS
  // -----------------------------
  const pagePresets = [
    {
      title: "Lesson Page",
      text: `Create a complete lesson page for students.

Include:
- Title
- Introduction (3–5 sentences)
- 3–5 sections with headings
- Detailed explanations
- Bullet points where appropriate
- Real-world example
- Final summary

Keep formatting clean and readable.`
    },
    {
      title: "Video Lesson",
      text: `Create a lesson page using videos.

Include:
- Title
- Intro paragraph
- 2–3 embedded videos
- Explanation before each video
- Key takeaways after each video
- Final summary`
    },
    {
      title: "Step-by-Step",
      text: `Create a step-by-step guide.

Include:
- Title
- Purpose
- At least 5 detailed steps
- Tips or mistakes
- Final checklist`
    },
    {
      title: "Concept Breakdown",
      text: `Explain a concept clearly.

Include:
- Definition
- Why it matters
- How it works
- Example
- Key points
- Summary`
    },
    {
      title: "Compare Topics",
      text: `Create a comparison page.

Include:
- Introduction
- Similarities
- Differences
- Conclusion`
    }
  ];

  const assignmentPresets = [
    {
      title: "Research",
      text: `Create a research assignment.

Include:
- Objective
- Instructions
- Topic choices
- Length requirement
- Rubric`
    },
    {
      title: "MC Quiz",
      text: `Create a multiple choice quiz.

Include:
- 10 questions
- 4 choices each
- Mark correct answers`
    },
    {
      title: "Short Answer",
      text: `Create short answer questions.

Include:
- 5–8 questions
- Answer key`
    },
    {
      title: "Project",
      text: `Create a project assignment.

Include:
- Goal
- Steps
- Materials
- Final product
- Rubric`
    },
    {
      title: "Scenario",
      text: `Create a scenario assignment.

Include:
- Situation
- Problem
- Questions
- Expected outcome`
    }
  ];

  // -----------------------------
  // TAMPERMONKEY LISTENER
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
  // BUILD PAGE (unchanged logic)
  // -----------------------------
  async function buildPage() {
    if (!input.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, theme })
      });

      const data = await res.json();
      setHtml(JSON.stringify(data, null, 2));
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
      <div style={{
        width: 360,
        padding: 16,
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>
        <h2>AI Page Builder</h2>

        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{ padding: 8 }}
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
          placeholder="Enter AI prompt..."
          style={{ flex: 1 }}
        />

        <button onClick={buildPage}>
          {loading ? "Building..." : "Build Page"}
        </button>

        <button onClick={copyHTML}>
          Copy HTML
        </button>
      </div>

      {/* RIGHT TEMPLATE PANEL */}
      <div style={{
        width: 260,
        borderRight: "1px solid #e5e7eb",
        padding: 10,
        background: "#f3f4f6",
        display: "flex",
        flexDirection: "column"
      }}>
        <h3 style={{ marginBottom: 8 }}>AI Templates</h3>

        <div style={{
          display: "flex",
          marginBottom: 10,
          background: "#e5e7eb",
          borderRadius: 6
        }}>
          <button
            onClick={() => setActiveTab("pages")}
            style={{
              flex: 1,
              padding: 8,
              background: activeTab === "pages" ? "#1e3a8a" : "transparent",
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
              padding: 8,
              background: activeTab === "assignments" ? "#1e3a8a" : "transparent",
              color: activeTab === "assignments" ? "#fff" : "#000",
              border: "none"
            }}
          >
            Assignments
          </button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {(activeTab === "pages" ? pagePresets : assignmentPresets).map((p, i) => (
            <button
              key={i}
              onClick={() => setInput(p.text)}
              style={{
                padding: 10,
                background: "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                textAlign: "left",
                fontSize: 13
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* PREVIEW */}
      <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
        <pre>{html}</pre>
      </div>

    </div>
  );
}