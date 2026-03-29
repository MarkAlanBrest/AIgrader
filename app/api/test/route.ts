export const runtime = "nodejs";

export async function POST(req: Request) {
  return Response.json({
    hasKey: !!process.env.OPENAI_API_KEY,
    env: process.env.VERCEL_ENV
  });
}