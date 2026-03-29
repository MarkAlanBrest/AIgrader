"use client";

import { useEffect, useState } from "react";

export default function Panel() {
  const [output, setOutput] = useState("Waiting for submission...");
  const [submission, setSubmission] = useState("");
  const [student, setStudent] = useState<any>(null);

  const [gradeValue, setGradeValue] = useState("");
  const [comments, setComments] = useState<string[]>([]);

  // -----------------------------
  // RECEIVE FROM TAMPERMONKEY
  // -----------------------------
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data?.type === "SUBMISSION_TEXT") {
        setSubmission(event.data.text || "");
        setStudent(event.data.student || null);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // -----------------------------
  // GRADE
  // -----------------------------
  async function grade() {
    if (!submission || submission.trim().length < 10) {
      setOutput("No submission detected.");
      return;
    }

    setOutput("Grading...");

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submission
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setOutput("Error grading.");
        return;
      }

      setGradeValue(data.grade || "");
      setComments(data.comments || []);

      setOutput(
        "AI Worked and used the Assignment instructions to offer these suggestions."
      );

    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  }

  // -----------------------------
  // APPLY BACK TO CANVAS
  // -----------------------------
  function apply() {
    const selected = [...document.querySelectorAll("input[type=checkbox]:checked")]
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
      fontFamily: "Arial"
    }}>

      {/* STUDENT */}
      <h2 style={{ color: "#38bdf8", marginTop: 0 }}>
        {student?.name || "Student"}
      </h2>

      {/* BUTTON */}
      <button onClick={grade} style={{
        padding: "10px",
        background: "#1e40af",
        color: "#fff",
        border: "none",
        borderRadius: 6
      }}>
        Grade
      </button>

      {/* STATUS */}
      <div style={{
        background: "#111827",
        padding: 10,
        marginTop: 10,
        borderRadius: 6
      }}>
        {output}
      </div>

      {/* GRADE */}
      {gradeValue && (
        <div style={{
          background: "#111827",
          padding: 10,
          marginTop: 10,
          borderRadius: 6
        }}>
          <div>Suggested Grade</div>
          <input
            value={gradeValue}
            onChange={(e) => setGradeValue(e.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />
        </div>
      )}

      {/* COMMENTS */}
      {comments.length > 0 && (
        <div style={{
          background: "#111827",
          padding: 10,
          marginTop: 10,
          borderRadius: 6
        }}>
          {comments.slice(0, 4).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input type="checkbox" defaultChecked value={c} />
              <div>{c}</div>
            </div>
          ))}
        </div>
      )}

      {/* APPLY */}
      {gradeValue && (
        <button onClick={apply} style={{
          marginTop: 10,
          padding: "10px",
          background: "#16a34a",
          color: "white",
          border: "none",
          borderRadius: 6
        }}>
          Submit to SpeedGrader
        </button>
      )}

    </div>
  );
}