export default function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;

  res.status(200).json({
    hasKey: !!apiKey,
    keyStart: apiKey ? apiKey.substring(0, 10) : null,
    env: process.env.VERCEL_ENV
  });
}