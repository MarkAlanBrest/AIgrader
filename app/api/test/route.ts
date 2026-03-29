export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY as string;

    if (!apiKey) {
      return Response.json({ error: "Missing API key" }, { status: 500 });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a grading assistant. Give a score (0-100) and short feedback."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await res.json();

    console.log("OPENAI RESPONSE:", data); // 👈 IMPORTANT

    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message || "OpenAI error" },
        { status: 500 }
      );
    }

    return Response.json({
      result:
        data?.choices?.[0]?.message?.content ||
        JSON.stringify(data, null, 2) // 👈 fallback so you SEE something
    });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}