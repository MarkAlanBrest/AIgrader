"use client";

import { useEffect, useState } from "react";

export default function Panel() {
  const [output, setOutput] = useState("Waiting for submission...");
  const [submission, setSubmission] = useState("");
  const [student, setStudent] = useState<any>(null);

  // ✅ Listen for submission + student info
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data?.type === "SUBMISSION_TEXT") {
        console.log("Incoming submission:", event.data.text);

        setSubmission(event.data.text || "");
        setStudent(event.data.student || null);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ✅ Grade function
  async function grade() {
    if (!submission || submission.trim().length < 10) {
      setOutput("No submission detected.");
      return;
    }

    setOutput("Grading...");

    try {
      const res = await fetch("https://a-igrader-ten.vercel.app/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Grade this submission:\n${submission}`
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setOutput(data.error || "Request failed");
        return;
      }

      const resultText = data.result || JSON.stringify(data, null, 2);
      setOutput(resultText);

      // 🔥 extract score + send back to Canvas
      const match = resultText.match(/(\d{1,3})\/100/);
      const score = match ? match[1] : "";

      window.parent.postMessage({
        type: "AI_GRADE_RESULT",
        score,
        feedback: resultText
      }, "*");

    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  }

  return (
    <div style={{
      padding: 16,
      background: "#0b1120",
      color: "#e5e7eb",
      height: "100vh",
      fontFamily: "Arial, sans-serif"
    }}>
      
      <h2 style={{ color: "#38bdf8", marginTop: 0 }}>
        AI Grader
      </h2>

      {/* 🔥 Student Info */}
      {student && (
        <div style={{
          background: "#111827",
          padding: 10,
          borderRadius: 6,
          marginBottom: 12,
          border: "1px solid #1f2937"
        }}>
          <div><strong>Student:</strong> {student.name}</div>
          <div><strong>Current Grade:</strong> {student.grade || "None"}</div>
          <div><strong>Current Comment:</strong></div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {student.comment || "No comment"}
          </div>
        </div>
      )}

      <button
        onClick={grade}
        style={{
          padding: "10px 16px",
          marginBottom: 12,
          background: "#1e40af",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }}
      >
        Grade Submission
      </button>

      {/* Submission Preview */}
      <div style={{ marginBottom: 12 }}>
        <strong>Submission Preview:</strong>
        <pre style={{
          maxHeight: 150,
          overflow: "auto",
          background: "#000",
          padding: 10,
          fontSize: 12,
          borderRadius: 6
        }}>
          {submission || "NO TEXT FOUND"}
        </pre>
      </div>

      {/* Output */}
      <div style={{
        background: "#111827",
        padding: 12,
        height: 300,
        overflow: "auto",
        borderRadius: 6,
        border: "1px solid #1f2937"
      }}>
        {output}
      </div>

    </div>
  );
}