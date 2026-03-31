export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    console.log("📥 Incoming RAW request body:", bodyText);

    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (err) {
      console.error("❌ Failed to parse incoming JSON:", err);
      return Response.json(
        { error: "Invalid JSON in request", raw: bodyText },
        { status: 400 }
      );
    }

    const { text } = parsedBody;

    if (!text) {
      console.error("❌ Missing 'text' field in request");
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("❌ Missing OPENAI_API_KEY");
      return Response.json(
        { error: "Missing API key" },
        { status: 500 }
      );
    }

    // -----------------------------
    // BUILD OPENAI REQUEST
    // -----------------------------
    const openAIRequest = {
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
    };

    console.log("📤 Sending to OpenAI:", JSON.stringify(openAIRequest, null, 2));

    // -----------------------------
    // OPENAI CALL
    // -----------------------------
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(openAIRequest)
    });

    const aiRaw = await aiRes.text();

    console.log("📥 RAW OpenAI response:", aiRaw);

    let aiJSON;
    try {
      aiJSON = JSON.parse(aiRaw);
    } catch (err) {
      console.error("❌ Failed to parse OpenAI JSON:", err);
      return Response.json({
        error: "OpenAI returned invalid JSON",
        raw: aiRaw
      });
    }

    const rawContent = aiJSON?.choices?.[0]?.message?.content;

    console.log("📄 OpenAI message.content:", rawContent);

    let parsed;

    try {
      parsed = JSON.parse(rawContent);
      console.log("✅ Successfully parsed AI JSON:", parsed);
    } catch (err) {
      console.error("❌ Failed to parse AI JSON:", err);
      parsed = {
        title: "Generated Page (Fallback)",
        sections: [
          { type: "text", content: text }
        ],
        diagnostics: {
          error: "AI returned invalid JSON",
          rawContent
        }
      };
    }

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return Response.json({
      ...parsed,
      diagnostics: {
        openAIRequest,
        openAIResponse: aiJSON
      }
    });

  } catch (err) {
    console.error("💥 SERVER CRASH:", err);

    return Response.json(
      {
        error: "Server error",
        details: String(err)
      },
      { status: 500 }
    );
  }
}
