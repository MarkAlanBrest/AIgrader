import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // -----------------------------
    // GET REQUEST BODY
    // -----------------------------
    const { submission, directions, keyCode, student } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json({
        grade: 0,
        comments: [
          "Missing API key",
          "Check environment settings",
          "Unable to grade",
          "Points lost due to system error"
        ]
      });
    }

    // -----------------------------
    // LOAD JSON KEY FILE
    // -----------------------------
    let rubric: any = {};

    try {
      if (keyCode) {
        const filePath = path.join(
          process.cwd(),
          "public",
          "keys",
          `${keyCode}.json`
        );

        if (fs.existsSync(filePath)) {
          const file = fs.readFileSync(filePath, "utf-8");
          rubric = JSON.parse(file);
        } else {
          console.log("JSON file not found:", filePath);
        }
      }
    } catch (err) {
      console.log("Error reading JSON:", err);
    }

    // -----------------------------
    // BUILD AI PROMPT FROM JSON
    // -----------------------------
    const studentName = student?.name || "the student";

    // Replace {{studentName}} in aiPrompt
    let aiPrompt = rubric.aiPrompt || "";
    aiPrompt = aiPrompt.replace(/{{studentName}}/g, studentName);

    // Final prompt sent to OpenAI
    const prompt = `
Return ONLY valid JSON with this structure:

{
  "grade": number,
  "comments": [
    "comment 1",
    "comment 2",
    "comment 3",
    "comment 4"
  ]
}

The JSON key below defines EXACTLY how to grade and what style of comments to produce.

JSON KEY:
${JSON.stringify(rubric, null, 2)}

AI INSTRUCTIONS (after name replacement):
${aiPrompt}

Submission:
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
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const text = await aiRes.text();

      try {
        const aiData = JSON.parse(text);
        raw = aiData?.choices?.[0]?.message?.content || "";
      } catch {
        console.log("OpenAI returned non-JSON:", text);
        raw = "";
      }
    } catch (err) {
      console.log("OpenAI fetch error:", err);
      raw = "";
    }

    // -----------------------------
    // CLEAN + PARSE AI RESPONSE
    // -----------------------------
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      return Response.json({
        grade: parsed.grade ?? 7, // AI already outputs 0–10
        comments: Array.isArray(parsed.comments)
          ? [
              parsed.comments[0] || "Good effort.",
              parsed.comments[1] || "Needs improvement.",
              parsed.comments[2] || "Check details.",
              parsed.comments[3] || "Points lost due to missing elements."
            ]
          : [
              "Good effort.",
              "Needs improvement.",
              "Check details.",
              "Points lost due to missing elements."
            ]
      });

    } catch {
      console.log("AI RAW (failed parse):", raw);

      return Response.json({
        grade: 7,
        comments: [
          "AI parsing failed.",
          "Check submission.",
          "Retry grading.",
          "Points lost due to evaluation error."
        ]
      });
    }

  } catch (err: any) {
    console.log("Server error:", err);

    return Response.json({
      grade: 0,
      comments: [
        "Server error",
        "Check API route",
        "Retry grading",
        "Points lost due to system failure"
      ]
    });
  }
}
