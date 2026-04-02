export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    // TEMP RESPONSE (so build works)
    return Response.json({
      title: "Page Built Successfully",
      sections: [
        { type: "heading", text: "API Fixed" },
        { type: "text", content: "Your build error is now gone." }
      ]
    });

  } catch (err) {
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}