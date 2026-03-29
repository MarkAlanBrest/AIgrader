export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "Missing API key" }, { status: 500 });
    }
 
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Grade the submission and return a score (0-100) and feedback."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await res.json();

    return Response.json({
      result: data?.choices?.[0]?.message?.content || "No response"
    });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}