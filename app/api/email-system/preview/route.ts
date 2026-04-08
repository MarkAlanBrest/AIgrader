export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSettings, getTemplates } from "../../../../lib/settings";
import { renderTemplate } from "../../../../lib/email-templates";

/**
 * Preview an email template with sample data (no Canvas API call needed)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailType } = body;

    if (!emailType) {
      return Response.json(
        { error: "Missing emailType" },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const templates = await getTemplates();
    const template = templates[emailType];

    if (!template) {
      return Response.json(
        { error: `Template not found: ${emailType}` },
        { status: 400 }
      );
    }

    const sampleVars: Record<string, string> = {
      studentName: "Alex",
      teacherName: settings.teacherName || "Professor Smith",
      courseName: settings.courseName || "Sample Course",
      daysForward: String(settings.daysForward || 7),
      daysBack: String(settings.daysBack || 14),
      assignmentList:
        "  - Essay Draft (Due: Monday, January 20, 2025, 100 pts)\n  - Chapter 5 Quiz (Due: Wednesday, January 22, 2025, 50 pts)\n  - Lab Report #3 (Due: Friday, January 24, 2025, 75 pts)",
      missingAssignmentList:
        "  - Homework #4 (Due: Monday, January 6, 2025, 25 pts)\n  - Reading Response #2 (Due: Wednesday, January 8, 2025, 30 pts)",
      currentGrade: "B+",
      currentScore: "87.5",
      missingSection:
        "Missing Assignments:\n  - Homework #4 (Due: Monday, January 6, 2025, 25 pts)\n  - Reading Response #2 (Due: Wednesday, January 8, 2025, 30 pts)",
      upcomingSection:
        "Upcoming Assignments:\n  - Essay Draft (Due: Monday, January 20, 2025, 100 pts)\n  - Chapter 5 Quiz (Due: Wednesday, January 22, 2025, 50 pts)",
    };

    const subject = renderTemplate(template.subject, sampleVars);
    const bodyText = renderTemplate(template.body, sampleVars);

    return Response.json({
      subject,
      body: bodyText,
      html: bodyText.replace(/\n/g, "<br>"),
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to preview template" },
      { status: 500 }
    );
  }
}
