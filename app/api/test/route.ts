export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { submission, rubric, student } = await req.json();
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
    // RUBRIC CHECK
    // -----------------------------
    if (!rubric) {
      return Response.json({
        grade: 0,
        comments: [
          "No rubric received.",
          "Assignment not configured.",
          "Check JSON setup.",
          "Grading failed."
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
    // BUILD PROMPT (STRICT)
    // -----------------------------
    const studentName = student?.name || "the student";

    const fullPrompt =
      "You must grade strictly using this rubric.\n\n" +
      JSON.stringify(rubric) +
      "\n\nStudent: " + studentName +
      "\n\nSubmission:\n" +
      submission;

    // -----------------------------
    // OPENAI CALL
    // -----------------------------
    let parsed;

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
                "Strict grading engine. Follow rubric exactly. No judgment. No averaging. Use only rules provided. Return ONLY JSON with grade and comments."
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