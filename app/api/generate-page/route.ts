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
        messages: [
          {
            role: "system",
            content:
              "You are a page builder. Return ONLY valid JSON with { title, sections: [] }",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    const aiText = data.choices?.[0]?.message?.content || "";

    // 🔧 Try parsing AI output
    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      return Response.json({
        title: "AI Error",
        sections: [
          {
            type: "text",
            content: "AI did not return valid JSON",
          }, 
          {
            type: "text",
            content: aiText,
          },
        ],
      });
    }

    return Response.json(parsed);

  } catch (err) {
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
} 