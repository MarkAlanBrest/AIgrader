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
    const cleanSubmission = String(submission || "").trim();
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

"You are a grading engine that MUST follow the grading instructions defined in the provided JSON. You must ignore spelling, grammar, and minor wording errors. You must not deduct points for spelling or grammar. You must grade based ONLY on conceptual correctness as defined in the JSON rubric. If the student’s meaning matches the correct concept or acceptable indicators, you must mark it correct even if the wording is imperfect. You must ALWAYS return a numeric field named \"grade\" between 0 and 100. Return valid JSON with exactly 4 comments."
            
            
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
    let grade = parsed.grade; // score + numberCorrect removed

    if (grade === undefined) {
      grade = 0;
    }

    // -----------------------------
    // FIXED COMMENT HANDLING
    // -----------------------------
    let comments = Array.isArray(parsed.comments) ? parsed.comments : [];

    comments = comments.map(c =>
      typeof c === "string"
        ? c.replace(/{{studentName}}/g, studentName)
        : c
    );

    while (comments.length < 4) {
      comments.push("");
    }

    comments = comments.slice(0, 4);

    comments = comments.map((c, i) => {
 if (!c || typeof c !== "string") {
  return `${studentName}, feedback unavailable.`;
}


      let clean = c.trim();

      clean = clean.replace(/^The student\s+/i, "you ");
      clean = clean.replace(/^Student\s+/i, "you ");
      clean = clean.replace(/^They\s+/i, "you ");
      clean = clean.replace(/^Their\s+/i, "your ");
      clean = clean.replace(/^The student’s\s+/i, "your ");

      clean = clean.charAt(0).toLowerCase() + clean.slice(1);

      return `${studentName}, ${clean}`;
    });

    // -----------------------------
    // BLANK SUBMISSION OVERRIDE
    // -----------------------------
    if (cleanSubmission.length === 0) {
      const blank = finalRubric.blankSubmissionPolicy;
      grade = blank?.grade ?? 0;
      comments = blank?.comments ?? [
        "No submission detected.",
        "Please resubmit your work.",
        "Unable to evaluate.",
        "Points lost due to missing content."
      ];
    }

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
