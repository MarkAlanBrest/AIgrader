export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ support BOTH old + new calls
    const submission =
      body.submission ||
      body.message ||
      "";

    const rubric = body.rubric || {};
    const directions = body.directions || "";

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "Missing API key" }, { status: 500 });
    }

    // -------------------------
    // PROMPT (CONTROLLED OUTPUT)
    // -------------------------
    const prompt = `
You are grading a student assignment.

STRICT RULES:
- Return ONLY valid JSON
- No extra text
- No markdown

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
- Use rubric if provided
- Use assignment instructions if provided

ASSIGNMENT INSTRUCTIONS:
${directions || "None"}

RUBRIC:
${JSON.stringify(rubric)}

STUDENT SUBMISSION:
${submission}
`;

    // -------------------------
    // OPENAI CALL
    // -------------------------
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await res.json();

    const raw = data?.choices?.[0]?.message?.content || "";

    // -------------------------
    // CLEAN RESPONSE
    // -------------------------
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      // ✅ FORCE 4 COMMENTS
      if (!parsed.comments || parsed.comments.length !== 4) {
        parsed.comments = [
          parsed.comments?.[0] || "Good effort",
          parsed.comments?.[1] || "Needs improvement",
          parsed.comments?.[2] || "Check details",
          "Points were lost due to missing required elements"
        ];
      }

      return Response.json(parsed);

    } catch (err) {
      console.log("AI RAW:", raw);

      return Response.json({
        grade: 70,
        comments: [
          "AI parsing failed",
          "Check submission",
          "Retry grading",
          "Points deducted due to evaluation error"
        ]
      });
    }

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}