export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, theme } = await req.json();

    if (!text) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    if (!theme) {
      return Response.json({ error: "No theme provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Missing API key" }, { status: 500 });
    }

    /* -------------------------------------------------------
       THEME STYLE GUIDES (AI-FRIENDLY)
    ------------------------------------------------------- */
    const themeGuides: Record<string, string> = {
      "Modern Blue": `
Use SVG icons.
Use a clean academic tone.
Use .container for grouped info.
Use .card for highlighted info.
Use .divider between major sections.
      `,
      "Minimal Gray": `
Use SVG icons.
Use a neutral, minimal tone.
Use .container for grouped info.
Use .card sparingly.
Use .divider only when needed.
      `,
      "Card Layout": `
Use emoji icons.
Use short, friendly language.
Use .card frequently.
Use .container for grouping.
Use .divider to break sections.
      `,
      "Hero Banner": `
Use SVG icons.
Use bold, energetic tone.
Use .container for supporting info.
Use .card for key callouts.
Use .divider between major sections.
      `,
      "Dark Mode": `
Use SVG icons.
Use concise, high-contrast language.
Use .container for structure.
Use .card for emphasis.
Use .divider to break content.
      `,
      "Soft Pastel": `
Use emoji icons.
Use warm, friendly tone.
Use .container for soft grouping.
Use .card for highlights.
Use .divider lightly.
      `
    };

    const styleGuide = themeGuides[theme] || "";

    /* -------------------------------------------------------
       CALL OPENAI
    ------------------------------------------------------- */
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
You are generating structured JSON for a Canvas page builder.

THEME: ${theme}

STYLE GUIDE:
${styleGuide}

Return ONLY valid JSON in this exact format:

{
  "title": "string",
  "sections": [
    { "type": "heading", "text": "string" },
    { "type": "text", "content": "string" },
    { "type": "list", "items": ["string"] },
    { "type": "video", "url": "string" },
    { "type": "container", "content": "string" },
    { "type": "card", "content": "string" },
    { "type": "divider" }
  ]
}

Rules:
- No markdown.
- No explanations.
- No extra fields.
- No nulls.
- No empty objects.
- All content must follow the theme.
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

    /* -------------------------------------------------------
       SAFE JSON PARSE
    ------------------------------------------------------- */
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        title: "Generated Page",
        sections: [{ type: "text", content: text }]
      };
    }

    return Response.json(parsed);
  } catch (err) {
    return Response.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
