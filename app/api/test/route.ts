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

    // -----------------------------
    // GET SUBMISSION + FILE LINK
    // -----------------------------
    let submission = body?.submission || "";

    let fileLink = "";

    if (submission.includes("[FILE LINK]")) {
      const parts = submission.split("[FILE LINK]");
      fileLink = parts[1]?.trim() || "";
    }

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
    let cleanSubmission = String(submission || "").trim();

    // -----------------------------
    // DOWNLOAD FILE (IF EXISTS)
    // -----------------------------
    let fileBuffer: ArrayBuffer | null = null;

    if (fileLink) {
      try {
        console.log("DOWNLOADING FILE:", fileLink);

        const fileRes = await fetch(fileLink);

        if (fileRes.ok) {
          fileBuffer = await fileRes.arrayBuffer();
          console.log("FILE DOWNLOADED");
        } else {
          console.log("FILE FAILED:", fileRes.status);
        }
      } catch (err) {
        console.log("FILE ERROR:", err);
      }
    }

    // -----------------------------
    // STUDENT NAME CLEAN
    // -----------------------------
    let studentName = student?.name || "the student";
    studentName = studentName.slice(2).split(" ")[0];

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
              content: "You must grade each question using rubric.questions."
            },
            {
              role: "user",
              content: fileBuffer
                ? [
                    { type: "text", text: fullPrompt },
                    { type: "input_file", file: fileBuffer }
                  ]
                : fullPrompt
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

    } catch (err) {
      console.log("AI ERROR:", err);
      parsed = {
        grade: undefined,
        comments: ["AI failed.", String(err), "", ""]
      };
    }

    // -----------------------------
    // GRADE FIX
    // -----------------------------
    let grade = parsed.grade;

    if (grade === undefined) {
      grade = 0;
    }

    // -----------------------------
    // COMMENTS FIX
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

    comments = comments.map((c) => {
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
    // BLANK SUBMISSION
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