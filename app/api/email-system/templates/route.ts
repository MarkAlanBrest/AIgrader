export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getTemplates, saveTemplate } from "../../../../lib/settings";

export async function GET() {
  try {
    const templates = await getTemplates();
    return Response.json(templates);
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to load templates" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, subject, body: templateBody } = body;

    if (!id || !name || !subject || !templateBody) {
      return Response.json(
        { error: "Missing required fields: id, name, subject, body" },
        { status: 400 }
      );
    }

    const templates = await saveTemplate(id, {
      id,
      name,
      subject,
      body: templateBody,
    });

    return Response.json({ success: true, templates });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to save template" },
      { status: 500 }
    );
  }
}
