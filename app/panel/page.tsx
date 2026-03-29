"use client";

import { useEffect, useState } from "react";

export default function Panel() {
  const [output, setOutput] = useState("Waiting for submission...");
  const [submission, setSubmission] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [directions, setDirections] = useState("");
  const [keyCode, setKeyCode] = useState("");

  const [gradeValue, setGradeValue] = useState("");
  const [comments, setComments] = useState<string[]>([]);

  // -----------------------------
  // RECEIVE FROM TAMPERMONKEY
  // -----------------------------
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data?.type === "SUBMISSION_TEXT") {
        console.log("Incoming submission:", event.data.text);

        setSubmission(event.data.text || "");
        setStudent(event.data.student || null);
        setDirections(event.data.directions || "");
        setKeyCode(event.data.keyCode || "");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // -----------------------------
  // GRADE FUNCTION
  // -----------------------------
  async function grade() {
    if (!submission || submission.trim().length < 10) {
      setOutput("No submission detected.");
      return;
    }

    setOutput("Grading...");
    setGradeValue("");
    setComments([]);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submission,
          directions,
          keyCode
        })
      });

      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("API returned HTML:", text);
        setOutput("API error — not valid JSON.");
        return;
      }

      if (!res.ok) {
        setOutput(data.error || "Request failed");
        return;
      }

      setGradeValue(String(data.grade || ""));
      setComments(Array.isArray(data.comments) ? data.comments : []);

      setOutput(
        "AI Worked and used the Assignment instructions to offer these suggestions."
      );

    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  }

  // -----------------------------
  // APPLY TO SPEEDGRADER
  // -----------------------------
  function applyToCanvas() {
    const selected = [...document.querySelectorAll('input[data-ai="1"]:checked')]
      .map((cb: any) => cb.value);

    window.parent.postMessage({
      type: "APPLY_GRADE",
      grade: gradeValue,
      generalComments: selected
    }, "*");
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

      {/* STUDENT INFO */}
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

      {/* STATUS */}
      <div style={{
        background: "#111827",
        padding: 12,
        minHeight: 60,
        borderRadius: 6,
        border: "1px solid #1f2937",
        marginBottom: 12
      }}>
        {output}
      </div>

      {/* GRADE */}
      {gradeValue && (
        <div style={{
          background: "#111827",
          padding: 12,
          borderRadius: 6,
          border: "1px solid #1f2937",
          marginBottom: 12
        }}>
          <div><strong>Suggested Grade</strong></div>
          <input
            value={gradeValue}
            onChange={(e) => setGradeValue(e.target.value)}
            style={{
              width: "100%",
              marginTop: 6,
              padding: 8,
              borderRadius: 6,
              border: "none",
              background: "#000",
              color: "#fff"
            }}
          />
        </div>
      )}

      {/* COMMENTS */}
      {comments.length > 0 && (
        <div style={{
          background: "#111827",
          padding: 12,
          borderRadius: 6,
          border: "1px solid #1f2937",
          marginBottom: 12
        }}>
          <strong>Suggested Comments</strong>

          {comments.slice(0, 4).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input type="checkbox" defaultChecked value={c} data-ai="1" />
              <div style={{ fontSize: 13 }}>{c}</div>
            </div>
          ))}

          <button
            onClick={applyToCanvas}
            style={{
              marginTop: 10,
              padding: "10px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 6
            }}
          >
            Submit to SpeedGrader
          </button>
        </div>
      )}

      {/* SUBMISSION PREVIEW */}
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

    </div>
  );
}