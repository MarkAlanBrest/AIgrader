"use client";

import { useEffect, useState } from "react";

export default function Panel() {
  const [assignmentLoaded, setAssignmentLoaded] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  const [rubricLoaded, setRubricLoaded] = useState(false);

  const [submission, setSubmission] = useState("");
  const [directions, setDirections] = useState("");
  const [keyCode, setKeyCode] = useState("");

  const [grade, setGrade] = useState<number | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  // -----------------------------
  // AUTO‑LOAD ASSIGNMENT (NO BUTTON)
  // -----------------------------
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data?.type === "SUBMISSION_TEXT") {
        (window as any).studentName = event.data.student?.name || "Student";

        setSubmission(event.data.text || "");
        setDirections(event.data.directions || "");
        setKeyCode(event.data.keyCode || "");

        setAssignmentLoaded(!!event.data.text && !!event.data.keyCode);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // -----------------------------
  // CALL BACKEND AI
  // -----------------------------
  async function generateAI() {
    if (!submission || !keyCode) return;

    setLoading(true);
    setAiConnected(false);
    setRubricLoaded(false);
    setGrade(null);
    setComments([]);
    setCopyStatus("");

    try {

      const res = await fetch("/api/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    submission,
    directions,
    keyCode,
  student: { name: (window as any).studentName || "Student" }
  })
});



      const data = await res.json();

      setGrade(data.grade ?? null);
      setComments(data.comments ?? []);

      setAiConnected(true);
      setRubricLoaded(true);
    } catch {
      setAiConnected(false);
      setRubricLoaded(false);
    }

    setLoading(false);
  }

  // -----------------------------
  // COPY ONLY SELECTED COMMENTS
  // -----------------------------
function copyComments() {
  const selected = Array.from(
    document.querySelectorAll("input[data-ai='1']:checked")
  ).map((cb: any) => cb.value as string);

  window.parent.postMessage(
    {
      type: "COPY_SELECTED_COMMENTS",
      comments: selected
    },
    "*"
  );

  setCopyStatus("Copied. Paste into SpeedGrader comments.");
}



  // -----------------------------
  // STATUS HELPER
  // -----------------------------
  function status(ok: boolean) {
    return ok ? (
      <span style={{ color: "#059669", fontWeight: 600 }}>Loaded Successfully</span>
    ) : (
      <span style={{ color: "#b91c1c", fontWeight: 600 }}>Not Loaded</span>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        background: "#ffffff",
        color: "#111827",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        overflowY: "auto",
        position: "relative"
      }}
    >
      <h2 style={{ marginTop: 0, color: "#1e40af" }}>AI Grader</h2>

      {/* STATUS BLOCK */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          padding: 12,
          borderRadius: 6,
          marginBottom: 16
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <strong>Assignment:</strong> {status(assignmentLoaded)}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>AI:</strong> {status(aiConnected)}
        </div>
        <div>
          <strong>Rubric (JSON):</strong> {status(rubricLoaded)}
        </div>
      </div>

      {/* GENERATE AI BUTTON */}
      <button
        onClick={generateAI}
        disabled={!assignmentLoaded || loading}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "#1e40af",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 16,
          opacity: assignmentLoaded ? 1 : 0.5
        }}
      >
        Generate AI Suggestions
      </button>

      {/* SUGGESTED GRADE */}
      {grade !== null && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          <strong>Suggested Grade</strong>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {grade}
          </div>
        </div>
      )}

      {/* COMMENTS + COPY BUTTON (REPLACES SUBMIT BUTTON) */}

      {/* Suggested Score */}
{grade !== null && (
  <div
    style={{
      marginBottom: 8,
      fontWeight: 600,
      fontSize: 16,
      color: "#1e3a8a"
    }}
  >
    Suggested Score: {grade}
  </div>
)}

      {comments.length > 0 && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          <strong>Suggested Comments</strong>

          {comments.map((c, i) => (
            <label
              key={i}
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                fontSize: 13,
                color: i === 3 ? "#b91c1c" : "#111827"
              }}
            >
              <input type="checkbox" defaultChecked value={c} data-ai="1" />
              {c}
            </label>
          ))}

          {/* THIS IS EXACTLY WHERE THE SUBMIT BUTTON USED TO BE */}
          <button
            onClick={copyComments}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "10px 16px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            Copy Comments
          </button>

          {copyStatus && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#6b7280"
              }}
            >
              {copyStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 