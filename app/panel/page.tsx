"use client";

import { useEffect, useState } from "react";

export default function Panel() {
  const [output, setOutput] = useState("Waiting for submission...");
  const [submission, setSubmission] = useState("");

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (event.data?.type === "SUBMISSION_TEXT") {
        console.log("Incoming submission:", event.data.text);
        setSubmission(event.data.text || "");
      }
    });
  }, []);

  async function grade() {
    setOutput("Grading...");

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Grade this submission:\n${submission}`
        })
      });

      const data = await res.json();
      setOutput(data.result || JSON.stringify(data, null, 2));
    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: 16, background: "#0b1120", color: "#e5e7eb", height: "100vh" }}>
      <h2 style={{ color: "#38bdf8" }}>AI Grader</h2>

      <button onClick={grade} style={{ padding: 10, marginBottom: 10 }}>
        Grade Submission
      </button>

      {/* 🔥 DEBUG: SHOW SUBMISSION */}
      <div style={{ marginBottom: 10 }}>
        <strong>Submission Preview:</strong>
        <pre style={{
          maxHeight: 150,
          overflow: "auto",
          background: "#000",
          padding: 10,
          fontSize: 12
        }}>
          {submission || "NO TEXT FOUND"}
        </pre>
      </div>

      <div style={{ background: "#111827", padding: 10, height: 300, overflow: "auto" }}>
        {output}
      </div>
    </div>
  );
}