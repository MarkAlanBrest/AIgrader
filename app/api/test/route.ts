export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  return Response.json({
    hasKey: !!apiKey,
    keyStart: apiKey ? apiKey.substring(0, 10) : null,
    env: process.env.VERCEL_ENV,
    projectUrl: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || null
  });
}