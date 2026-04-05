import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};

  try {
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    console.log("REQUEST BODY:", body);

    const submission = body?.submission || "";
    const directions = body?.directions || "";
    const rubric = typeof body?.rubric === "object" ? body.rubric : {};
    const student = body?.student || {};

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json({
        grade: 0,
        comments: [
          "Missing API key.",
          "System configuration error.",
          "Unable to grade.",
          "Points lost due to system error."
        ]
      });
    }

    let finalRubric: any = rubric || {};

    if (!submission.trim()) {
      const blank = finalRubric.blankSubmissionPolicy;

      return Response.json({
        grade: blank?.grade ?? 0,
        comments:
          blank?.comments ?? [
            "No submission detected.",
            "Please resubmit your work.",
            "Unable to evaluate.",
            "Points lost due to missing content."
          ]
      });
    }

    const studentName = student?.name || "the student";

    let aiPrompt = finalRubric?.aiPrompt || directions || "";
    aiPrompt = aiPrompt.replace(/{{studentName}}/g, studentName);

    let rubricWithName = "{}";
    try {
      rubricWithName = JSON.stringify(finalRubric, null, 2).replace(/{{studentName}}/g, studentName);
    } catch {
      rubricWithName = "{}";
    }

    const fullPrompt =
      "Grading configuration (THIS DEFINES ALL GRADING RULES — FOLLOW EXACTLY):\n\n" +
      rubricWithName +
      "\n\nInstructions:\n" +
      aiPrompt +
      "\n\nStudent Submission:\n" +
      submission;

    let parsed: any = {
      grade: undefined,
      comments: []
    };

    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a grading engine that MUST follow the grading instructions defined in the provided JSON. The JSON completely defines how grading is performed. You must not override, ignore, or reinterpret the grading method. Always follow the aiPrompt and grading rules exactly as written. Return valid JSON with exactly 4 comments."
            },
            {
              role: "user",
              content: fullPrompt
            }
          ]
        })
      });

      const aiData = await aiRes.json();
      const raw = aiData?.choices?.[0]?.message?.content || "{}";

      console.log("RAW AI RESPONSE:", raw);

      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          grade: undefined,
          comments: ["Bad AI JSON", raw, "", ""]
        };
      }

    } catch {
      parsed = {
        grade: undefined,
        comments: ["AI failed.", "Retry grading.", "", ""]
      };
    }

    // -----------------------------
    // FIXED GRADE LOGIC
    // -----------------------------
    let grade = parsed.grade ?? parsed.score;

    if (grade === undefined && parsed.numberCorrect !== undefined) {
      const total = finalRubric?.questions?.length || 1;
      grade = (parsed.numberCorrect / total) * 100;
    }

    if (grade === undefined) {
      grade = 0;
    }

    // -----------------------------
    // FIXED COMMENT HANDLING
    // -----------------------------


let comments = Array.isArray(parsed.comments) ? parsed.comments : [];

// inject name into AI comments
comments = comments.map(c =>
  typeof c === "string"
    ? c.replace(/{{studentName}}/g, studentName)
    : c
);




    // ensure 4 comments
    while (comments.length < 4) {
      comments.push("");
    }

    comments = comments.slice(0, 4);

    comments = comments.map((c, i) => {
      if (!c || c.trim().length < 10) {
        if (i < 3) {
          return "The student demonstrated a solid understanding of the material and correctly answered most of the questions.";
        } else {
          return "Points were lost because one or more answers were incorrect or missing and did not meet the required criteria.";
        }
      }
      return c;
    });

    return Response.json({
      grade,
      comments
    });

  } catch (err: any) {
    return Response.json({
      grade: 0,
      comments: [
        "Server crash caught",
        err?.message || "",
        "",
        ""
      ]
    });
  }
}