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
    <div style={{ padding: 16, background: "#0b1120", color: "#e5e7eb", height: "100vh" }}>
      <h2 style={{ color: "#38bdf8" }}>AI Grader Panel</h2>

      <button onClick={testAI} style={{ padding: 10, marginBottom: 10 }}>
        Test AI
      </button>

      <div style={{ background: "#111827", padding: 10 }}>
        {output}
      </div>
    </div>
  );
}