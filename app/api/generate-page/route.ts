export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `
Return ONLY valid JSON.

Do NOT explain anything.
Do NOT include markdown.

Output format:
{
  "title": "",
  "sections": [
    { "type": "heading", "text": "" },
    { "type": "text", "content": "" },
    { "type": "list", "items": [] },
    { "type": "video", "url": "" }
  ]
}
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

    let parsed;

    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      // fallback (very important)
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