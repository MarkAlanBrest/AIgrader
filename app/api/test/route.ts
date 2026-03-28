export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Get message from request
    const { message } = await req.json();

    // Force TypeScript to treat as string
    const apiKey = process.env.OPENAI_API_KEY as string;

    // Safety check
    if (!apiKey) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // Call OpenAI
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: message || "Say: AI grader test successful.",
          },
        ],
      }),
    });

    const data = await res.json();

    // Handle API errors
    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message || "OpenAI request failed" },
        { status: 500 }
      );
    }

    // Return clean result
    return Response.json({
      result: data.choices?.[0]?.message?.content || "No response",
    });

  } catch (error: any) {
    return Response.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}