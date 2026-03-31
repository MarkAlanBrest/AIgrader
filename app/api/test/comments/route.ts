import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "public", "comments.json");

// GET = read
export async function GET() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Response.json(data);
}

// POST = add comment
export async function POST(req: Request) {
  const { category, text } = await req.json();

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  data.push({ category, text });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return Response.json({ success: true });
}