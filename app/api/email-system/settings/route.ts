export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSettings, saveSettings } from "../../../../lib/settings";

export async function GET() {
  try {
    const settings = await getSettings();
    // Mask sensitive fields for the frontend
    const masked = {
      ...settings,
      canvasToken: settings.canvasToken ? "••••••••" : "",
      smtpPass: settings.smtpPass ? "••••••••" : "",
      twilioAuthToken: settings.twilioAuthToken ? "••••••••" : "",
    };
    return Response.json(masked);
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Don't overwrite sensitive fields if they're masked
    const current = await getSettings();
    const updates: Record<string, any> = { ...body };

    if (updates.canvasToken === "••••••••") {
      updates.canvasToken = current.canvasToken;
    }
    if (updates.smtpPass === "••••••••") {
      updates.smtpPass = current.smtpPass;
    }
    if (updates.twilioAuthToken === "••••••••") {
      updates.twilioAuthToken = current.twilioAuthToken;
    }

    const saved = await saveSettings(updates);
    return Response.json({ success: true, settings: saved });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to save settings" },
      { status: 500 }
    );
  }
}
