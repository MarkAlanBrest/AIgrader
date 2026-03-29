import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { submission, directions, keyCode, student } = await req.json();
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

    // -----------------------------
    // LOAD KEY FILE
    // -----------------------------
    let rubric: any = null;

    if (keyCode) {
      const filePath = path.join(process.cwd(), "public", "keys", `${keyCode}.json`);

      if (fs.existsSync(filePath)) {
        rubric = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    }

    if (!rubric) {
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
    // BLANK SUBMISSION OVERRIDE
    // -----------------------------
    if (!submission || !submission.trim()) {
      const blank = rubric.blankSubmissionPolicy;

      return Response.json({
        grade: blank?.grade ?? 0,
        comments: blank?.comments ?? [
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

    let aiPrompt = rubric.aiPrompt || "";
    aiPrompt = aiPrompt.replace(/{{studentName}}/g, studentName);

    const systemPrompt = `
RETURN ONLY VALID JSON.
NO MARKDOWN.
NO TEXT OUTSIDE JSON.

If you cannot follow instructions, return EXACTLY:
{"grade":0,"comments":["AI failed","Invalid output","Retry","System error"]}

FOLLOW THE RUBRIC EXACTLY.
FOLLOW blankSubmissionPolicy EXACTLY.
`;

    const fullPrompt = `
SYSTEM RULES:
${systemPrompt}

RUBRIC JSON:
${JSON.stringify(rubric, null, 2)}

AI INSTRUCTIONS:
${aiPrompt}

STUDENT SUBMISSION:
${submission}
`;

    // -----------------------------
    // OPENAI CALL
    // -----------------------------
    let raw = "";

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
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: fullPrompt
            }
          ]
        })
      });

      const text = await aiRes.text();

      try {
        const aiData = JSON.parse(text);
        raw = aiData?.choices?.[0]?.message?.content || "";
      } catch {
        raw = "";
      }
    } catch {
      raw = "";
    }

    // -----------------------------
    // CLEAN + PARSE AI RESPONSE
    // -----------------------------
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      return Response.json({
        grade: parsed.grade ?? 0,
        comments: parsed.comments ?? [
          "AI returned incomplete data.",
          "Check submission.",
          "Retry grading.",
          "Points lost due to evaluation error."
        ]
      });

    } catch {
      return Response.json({
        grade: 0,
        comments: [
          "AI parsing failed.",
          "Invalid response format.",
          "Retry grading.",
          "Points lost due to evaluation error."
        ]
      });
    }

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
