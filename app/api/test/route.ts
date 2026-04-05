import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ✅ ADD rubric (keep everything else)
    const { submission, directions, keyCode, rubric, student } = await req.json();
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
    // LOAD RUBRIC FILE (UNCHANGED STYLE)
    // -----------------------------
    let finalRubric: any = null;

    // ✅ USE PASSED JSON FIRST
    if (rubric) {
      finalRubric = rubric;
    }

    // (keeps your structure intact if you ever go back)
    if (!finalRubric) {
      finalRubric = {}; // allow grading with no rubric
    }

    if (!finalRubric) {
      return Response.json({
        grade: 0,
        comments: [
          "Key file missing.",
          "Assignment is not configured for AI grading.",
          "Please re-add the KeyCode.",
          "Points lost due to missing configuration."
        ]
      });
    }

    // -----------------------------
    // BLANK SUBMISSION CHECK
    // -----------------------------
    if (!submission || !submission.trim()) {
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

    // ✅ FORCE JSON aiPrompt FIRST
    let aiPrompt = finalRubric?.aiPrompt || directions || "";
    aiPrompt = aiPrompt.replace(/{{studentName}}/g, studentName);

    // ✅ USE finalRubric instead of empty rubric
    const rubricWithName = JSON.stringify(finalRubric, null, 2).replace(/{{studentName}}/g, studentName);

    // ✅ SAFER PROMPT (no drift)
    const fullPrompt =
      "Use this rubric exactly:\n\n" +
      rubricWithName +
      "\n\nInstructions:\n" +
      aiPrompt +
      "\n\nStudent Submission:\n" +
      submission;

    // -----------------------------
    // OPENAI CALL (FIXED)
    // -----------------------------
    let parsed;

    try {
      const aiRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
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

                // ✅ FIXED (no red errors, strict)
                content: "Strict grading engine. Follow rubric exactly. No judgment. No averaging. Use only rules provided. Return ONLY JSON with grade and comments."
              },
              {
                role: "user",
                content: fullPrompt
              }
            ]
          })
        }
      );

      const aiData = await aiRes.json();
      const raw = aiData?.choices?.[0]?.message?.content || "{}";

      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        grade: 0,
        comments: [
          "AI failed.",
          "Retry grading.",
          "Check submission.",
          "System fallback."
        ]
      };
    }

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return Response.json({
      grade: parsed.grade ?? 0,
      comments: parsed.comments ?? [
        "AI returned incomplete data.",
        "Check submission.",
        "Retry grading.",
        "Evaluation issue."
      ]
    });

  } catch (err) {
    return Response.json({
      grade: 0,
      comments: [
        "Server error.",
        "Unexpected failure.",
        "Retry grading.",
        "Points lost due to system failure."
      ]
    });
  }
}