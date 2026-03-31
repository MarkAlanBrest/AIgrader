export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing API key" },
        { status: 500 }
      );
    }

    // -----------------------------
    // OPENAI CALL (JSON ENFORCED)
    // -----------------------------
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
Return ONLY valid JSON in this exact format:

{
  "title": "string",
  "sections": [
    { "type": "heading", "text": "string" },
    { "type": "text", "content": "string" },
    { "type": "list", "items": ["string"] },
    { "type": "video", "url": "string" }
  ]
}

Rules:
- No markdown
- No explanations
- No extra fields
- No commentary
`
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback if AI returns invalid JSON
      parsed = {
        title: "Generated Page",
        sections: [
          { type: "text", content: text }
        ]
      };
    }

    return Response.json(parsed);

  } catch (err) {
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
