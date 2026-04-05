import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};

  try {
    // -----------------------------
    // SAFE BODY PARSE (prevents crash)
    // -----------------------------
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

    // -----------------------------
    // API KEY CHECK
    // -----------------------------
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

    // -----------------------------
    // USE RUBRIC (SAFE)
    // -----------------------------
    let finalRubric: any = rubric || {};

    // -----------------------------
    // BLANK SUBMISSION CHECK
    // -----------------------------
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

    // -----------------------------
    // BUILD PROMPT
    // -----------------------------
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
"Grading configuration (THIS DEFINES ALL GRADING RULES — FOLLOW EXACTLY):\n\n"
      rubricWithName +
      "\n\nInstructions:\n" +
      aiPrompt +
      "\n\nStudent Submission:\n" +
      submission;

    // -----------------------------
    // OPENAI CALL
    // -----------------------------
    let parsed: any = {
      grade: 0,
      comments: ["Default fallback", "", "", ""]
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
          grade: 0,
          comments: ["Bad AI JSON", raw, "", ""]
        };
      }

    } catch {
      parsed = {
        grade: 0,
        comments: ["AI failed.", "Retry grading.", "", ""]
      };
    }

    // -----------------------------
    // FINAL RESPONSE (ALWAYS JSON)
    // -----------------------------
  const rawComments = Array.isArray(parsed.comments) ? parsed.comments : [];

let comments = rawComments.slice(0, 4);

// ensure 4 comments
while (comments.length < 4) {
  comments.push("");
}

// enforce structure + sentence length
comments = comments.map((c, i) => {
  if (!c || c.length < 20) {
    if (i < 3) {
      return "The student demonstrated a solid understanding of the material and correctly answered most of the questions.";
    } else {
      return "Points were lost because one or more answers were incorrect or missing and did not meet the required criteria.";
    }
  }
  return c;
});

return Response.json({
grade: parsed.grade ?? parsed.score ?? 0,
  comments
});





  } catch (err: any) {
    // 🔴 GUARANTEED NO WHITE SCREEN
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