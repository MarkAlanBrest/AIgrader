export const runtime = "nodejs";

export async function POST() {
  return Response.json({
    hasKey: !!process.env.OPENAI_API_KEY,
    keyStart: process.env.OPENAI_API_KEY?.substring(0, 10) || null,
    env: process.env.VERCEL_ENV,
    url: process.env.VERCEL_URL
  });
}