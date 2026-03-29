export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "iad1"; // 👈 IMPORTANT

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  return Response.json({
    hasKey: !!apiKey,
    keyStart: apiKey ? apiKey.substring(0, 10) : null,
    env: process.env.VERCEL_ENV,
    region: process.env.VERCEL_REGION
  });
}