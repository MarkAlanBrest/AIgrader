export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `
You are a strict JSON generator.

RULES:
- Return ONLY valid JSON.
- NO HTML tags anywhere.
- All fields must be plain text.
- Lists must be arrays of plain strings.
- Headings must be plain text.
- Callout content must be plain text.
- Grid items must be plain text.
- Never wrap text in <p>, <div>, <span>, <strong>, <em>, or any HTML tag.
- Never include markdown (#, **, etc).

REQUIRED STRUCTURE:
{
  "title": "string",
  "sections": [
    { "type": "heading", "text": "string" },
    { "type": "text", "content": "string" },
    { "type": "list", "items": ["string"] },
    { "type": "callout", "style": "info", "content": "string" },
    { "type": "divider" },
    { "type": "grid", "columns": 3, "items": ["string"] },
    { "type": "text", "content": "string" }
  ]
}
          `,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "";

    // -----------------------------
    // SANITIZER: Remove HTML if AI slips
    // -----------------------------
    const stripHTML = (str: string) =>
      str
        ?.replace(/<\/?[^>]+(>|$)/g, "") // remove all HTML tags
        ?.replace(/\s+/g, " ") // normalize whitespace
        ?.trim();

    // -----------------------------
    // Try parsing JSON
    // -----------------------------
    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      return Response.json({
        title: "AI Error",
        sections: [
          { type: "text", content: "AI did not return valid JSON." },
          { type: "text", content: aiText },
        ],
      });
    }

    // -----------------------------
    // ENFORCE CANVAS-SAFE JSON
    // -----------------------------
    if (!parsed.title) parsed.title = "Untitled Page";
    parsed.title = stripHTML(parsed.title);

    if (!Array.isArray(parsed.sections)) parsed.sections = [];

    parsed.sections = parsed.sections.map((sec: any) => {
      if (!sec || typeof sec !== "object") return null;

      const type = sec.type;

      if (type === "heading") {
        return {
          type: "heading",
          text: stripHTML(sec.text || ""),
        };
      }

      if (type === "text") {
        return {
          type: "text",
          content: stripHTML(sec.content || ""),
        };
      }

      if (type === "list") {
        return {
          type: "list",
          items: Array.isArray(sec.items)
            ? sec.items.map((i: string) => stripHTML(i))
            : [],
        };
      }

      if (type === "callout") {
        return {
          type: "callout",
          style: sec.style || "info",
          content: stripHTML(sec.content || ""),
        };
      }

      if (type === "divider") {
        return { type: "divider" };
      }

      if (type === "grid") {
        return {
          type: "grid",
          columns: sec.columns || 3,
          items: Array.isArray(sec.items)
            ? sec.items.map((i: string) => stripHTML(i))
            : [],
        };
      }

      return null;
    }).filter(Boolean);

    return Response.json(parsed);

  } catch (err) {
    return Response.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
