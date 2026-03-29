import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { submission, directions, keyCode, student } = await req.json();
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
    // LOAD RUBRIC FILE
    // -----------------------------
    let rubric: any = null;

    if (keyCode) {
      const filePath = path.join(
        process.cwd(),
        "public",
        "keys",
        `${keyCode}.json`
      );

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
    // BLANK SUBMISSION CHECK
    // -----------------------------
    if (!submission || !submission.trim()) {
      const blank = rubric.blankSubmissionPolicy;

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

    let aiPrompt = rubric.aiPrompt || "";
    aiPrompt = aiPrompt.replace(/{{studentName}}/g, studentName);

    const fullPrompt = `
RUBRIC JSON:
${JSON.stringify(rubric, null, 2)}

INSTRUCTIONS:
${aiPrompt}

STUDENT SUBMISSION:
${submission}
`;

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
                content:
                  "Return JSON with: grade (number) and comments (array of 4 strings)."
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