import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { submission, directions, keyCode } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    // -----------------------------
    // ALWAYS RETURN VALID JSON (even on error)
    // -----------------------------
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
    // LOAD LOCAL JSON (SAFE)
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
    // PROMPT
    // -----------------------------
    const prompt = `
Return ONLY valid JSON.

{
 "grade": number,
 "comments": [
  "Positive feedback",
  "Improvement suggestion",
  "Another suggestion",
  "Explain what points were lost and why"
 ]
}

Rules:
- Always return exactly 4 comments
- The 4th must explain lost points
- Grade out of 100

Instructions:
${directions || "None"}

Rubric:
${JSON.stringify(rubric)}

Submission:
${submission}
`;

    // -----------------------------
    // OPENAI CALL (SAFE)
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

      // 🔥 If OpenAI returns HTML or error, we catch it here
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
    // CLEAN RESPONSE
    // -----------------------------
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      return Response.json({
        grade: parsed.grade ?? 70,
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
        grade: 70,
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