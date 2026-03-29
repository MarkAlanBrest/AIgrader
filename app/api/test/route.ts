export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // -----------------------------
    // GET DATA FROM PANEL
    // -----------------------------
    const body = await req.json();

    const submission = body.submission || "";
    const directions = body.directions || "";
    const keyCode = body.keyCode || "";

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing API key" },
        { status: 500 }
      );
    }

    // -----------------------------
    // PROMPT
    // -----------------------------
    const prompt = `
You are grading a student assignment.

STRICT RULES:
- Return ONLY valid JSON
- No explanation
- No markdown
- No extra text

FORMAT:
{
  "grade": number,
  "comments": [
    "Positive feedback",
    "Improvement suggestion",
    "Another suggestion",
    "Explain what points were lost and why"
  ]
}

REQUIREMENTS:
- Always return exactly 4 comments
- The 4th comment MUST explain lost points
- Grade out of 100

ASSIGNMENT INSTRUCTIONS:
${directions || "None"}

ASSIGNMENT KEYCODE:
${keyCode || "None"}

STUDENT SUBMISSION:
${submission}
`;

    // -----------------------------
    // OPENAI CALL
    // -----------------------------
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const aiData = await aiRes.json();

    const raw = aiData?.choices?.[0]?.message?.content || "";

    // -----------------------------
    // CLEAN RESPONSE
    // -----------------------------
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      // -----------------------------
      // FORCE STRUCTURE SAFETY
      // -----------------------------
      return Response.json({
        grade: parsed.grade ?? 70,
        comments: Array.isArray(parsed.comments)
          ? [
              parsed.comments[0] || "Good effort.",
              parsed.comments[1] || "Needs improvement.",
              parsed.comments[2] || "Check details more carefully.",
              parsed.comments[3] || "Points were lost due to missing required elements."
            ]
          : [
              "Good effort.",
              "Needs improvement.",
              "Check details more carefully.",
              "Points were lost due to missing required elements."
            ]
      });

    } catch (err) {
      console.error("AI RAW RESPONSE:", raw);

      return Response.json({
        grade: 70,
        comments: [
          "AI parsing failed.",
          "Check submission.",
          "Retry grading.",
          "Points were lost due to evaluation error."
        ]
      });
    }

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}