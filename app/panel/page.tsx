"use client";

import { useState } from "react";

export default function Panel() {
  const [output, setOutput] = useState("Waiting for input...");

  async function testAI() {
    setOutput("Sending request...");

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Say: AI grader test successful."
        })
      });

      const data = await res.json();
      setOutput(data.result || "No response.");
    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  }

  return (
    <div
      style={{
        margin: 0,
        padding: 16,
        fontFamily: "Arial, sans-serif",
        background: "#0b1120",
        color: "#e5e7eb",
        height: "100vh"
      }}
    >
      <h2 style={{ marginTop: 0, color: "#38bdf8" }}>
        AI Grader Panel
      </h2>

      <button
        onClick={testAI}
        style={{
          background: "#1e40af",
          color: "white",
          border: "none",
          padding: "10px 16px",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 12
        }}
      >
        Test AI
      </button>

      <div
        style={{
          whiteSpace: "pre-wrap",
          background: "#111827",
          padding: 12,
          borderRadius: 6,
          border: "1px solid #1f2937",
          height: 300,
          overflowY: "auto"
        }}
      >
        {output}
      </div>
    </div>
  );
}