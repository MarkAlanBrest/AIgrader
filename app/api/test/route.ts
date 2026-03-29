export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 🔥 IMPORTANT

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  console.log("KEY CHECK:", apiKey);

  return Response.json({
    hasKey: !!apiKey,
    keyStart: apiKey ? apiKey.substring(0, 10) : null,
    env: process.env.VERCEL_ENV,
    url: process.env.VERCEL_URL
  });
}