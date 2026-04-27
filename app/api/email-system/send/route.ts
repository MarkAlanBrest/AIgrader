export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSettings, getTemplates } from "../../../../lib/settings";
import {
  getStudents,
  getUpcomingAssignments,
  getMissingAssignments,
  getStudentGradeReport,
  postAnnouncement,
} from "../../../../lib/canvas-api";
import {
  renderTemplate,
  formatAssignmentList,
} from "../../../../lib/email-templates";
import { sendEmail, type SmtpConfig } from "../../../../lib/send-email";
import { sendSms, type SmsConfig } from "../../../../lib/send-sms";

interface SendRequest {
  emailType: "upcoming" | "missing" | "welcome" | "evaluation";
  includeAnnouncement?: boolean;
  includeSms?: boolean;
  daysForward?: number;
  daysBack?: number;
}

export async function POST(req: Request) {
  try {
    const body: SendRequest = await req.json();
    const { emailType, includeAnnouncement, includeSms } = body;

    if (!emailType) {
      return Response.json(
        { error: "Missing emailType" },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const templates = await getTemplates();

    if (!settings.canvasBaseUrl || !settings.canvasToken || !settings.courseId) {
      return Response.json(
        { error: "Canvas settings not configured. Please set up Canvas API URL, token, and course ID in Settings." },
        { status: 400 }
      );
    }

    const smtpConfig: SmtpConfig = {
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      pass: settings.smtpPass,
      from: settings.smtpFrom || settings.teacherEmail,
    };

    const smsConfig: SmsConfig = {
      accountSid: settings.twilioSid,
      authToken: settings.twilioAuthToken,
      fromNumber: settings.twilioPhoneNumber,
    };

    const daysForward = body.daysForward ?? settings.daysForward ?? 7;
    const daysBack = body.daysBack ?? settings.daysBack ?? 14;

    const students = await getStudents(
      settings.canvasBaseUrl,
      settings.canvasToken,
      settings.courseId
    );

    if (students.length === 0) {
      return Response.json(
        { error: "No students found in the course." },
        { status: 400 }
      );
    }

    const template = templates[emailType];
    if (!template) {
      return Response.json(
        { error: `Template not found for email type: ${emailType}` },
        { status: 400 }
      );
    }

    const results = {
      emailsSent: 0,
      emailsFailed: 0,
      smsSent: 0,
      smsFailed: 0,
      announcementPosted: false,
      errors: [] as string[],
      details: [] as { student: string; email: boolean; sms: boolean }[],
    };

    // ---- UPCOMING ASSIGNMENTS ----
    if (emailType === "upcoming") {
      const upcoming = await getUpcomingAssignments(
        settings.canvasBaseUrl,
        settings.canvasToken,
        settings.courseId,
        daysForward
      );

      const assignmentListStr = formatAssignmentList(upcoming);

      for (const student of students) {
        const vars = {
          studentName: student.name.split(" ")[0],
          teacherName: settings.teacherName,
          courseName: settings.courseName,
          assignmentList: assignmentListStr,
          daysForward: String(daysForward),
        };

        const subject = renderTemplate(template.subject, vars);
        const text = renderTemplate(template.body, vars);

        let emailOk = false;
        let smsOk = false;

        if (student.email) {
          const res = await sendEmail(smtpConfig, {
            to: student.email,
            subject,
            text,
          });
          if (res.success) {
            results.emailsSent++;
            emailOk = true;
          } else {
            results.emailsFailed++;
            results.errors.push(`Email to ${student.name}: ${res.error}`);
          }
        }

        if (includeSms && student.phone) {
          const smsBody = `${settings.teacherName}: ${upcoming.length} upcoming assignment(s) in ${settings.courseName}. Check your email for details.`;
          const res = await sendSms(smsConfig, {
            to: student.phone,
            body: smsBody,
          });
          if (res.success) {
            results.smsSent++;
            smsOk = true;
          } else {
            results.smsFailed++;
            results.errors.push(`SMS to ${student.name}: ${res.error}`);
          }
        }

        results.details.push({
          student: student.name,
          email: emailOk,
          sms: smsOk,
        });
      }

      if (includeAnnouncement) {
        try {
          const announcementVars = {
            studentName: "Class",
            teacherName: settings.teacherName,
            courseName: settings.courseName,
            assignmentList: assignmentListStr,
            daysForward: String(daysForward),
          };
          const announcementBody = renderTemplate(
            template.body,
            announcementVars
          );
          await postAnnouncement(
            settings.canvasBaseUrl,
            settings.canvasToken,
            settings.courseId,
            `Upcoming Assignments - Next ${daysForward} Days`,
            announcementBody.replace(/\n/g, "<br>")
          );
          results.announcementPosted = true;
        } catch (err: any) {
          results.errors.push(`Announcement: ${err?.message}`);
        }
      }
    }

    // ---- MISSING WORK ----
    if (emailType === "missing") {
      for (const student of students) {
        const missing = await getMissingAssignments(
          settings.canvasBaseUrl,
          settings.canvasToken,
          settings.courseId,
          student.id,
          daysBack
        );

        if (missing.length === 0) {
          results.details.push({
            student: student.name,
            email: false,
            sms: false,
          });
          continue;
        }

        const missingListStr = formatAssignmentList(missing);
        const vars = {
          studentName: student.name.split(" ")[0],
          teacherName: settings.teacherName,
          courseName: settings.courseName,
          missingAssignmentList: missingListStr,
          daysBack: String(daysBack),
        };

        const subject = renderTemplate(template.subject, vars);
        const text = renderTemplate(template.body, vars);

        let emailOk = false;
        let smsOk = false;

        if (student.email) {
          const res = await sendEmail(smtpConfig, {
            to: student.email,
            subject,
            text,
          });
          if (res.success) {
            results.emailsSent++;
            emailOk = true;
          } else {
            results.emailsFailed++;
            results.errors.push(`Email to ${student.name}: ${res.error}`);
          }
        }

        if (includeSms && student.phone) {
          const smsBody = `${settings.teacherName}: You have ${missing.length} missing assignment(s) in ${settings.courseName}. Please check your email.`;
          const res = await sendSms(smsConfig, {
            to: student.phone,
            body: smsBody,
          });
          if (res.success) {
            results.smsSent++;
            smsOk = true;
          } else {
            results.smsFailed++;
            results.errors.push(`SMS to ${student.name}: ${res.error}`);
          }
        }

        results.details.push({
          student: student.name,
          email: emailOk,
          sms: smsOk,
        });
      }

      if (includeAnnouncement) {
        try {
          await postAnnouncement(
            settings.canvasBaseUrl,
            settings.canvasToken,
            settings.courseId,
            "Missing Work Reminder",
            `This is a reminder to check Canvas for any missing assignments from the past ${daysBack} days. Please reach out if you need help. - ${settings.teacherName}`
          );
          results.announcementPosted = true;
        } catch (err: any) {
          results.errors.push(`Announcement: ${err?.message}`);
        }
      }
    }

    // ---- WELCOME ----
    if (emailType === "welcome") {
      for (const student of students) {
        const vars = {
          studentName: student.name.split(" ")[0],
          teacherName: settings.teacherName,
          courseName: settings.courseName,
        };

        const subject = renderTemplate(template.subject, vars);
        const text = renderTemplate(template.body, vars);

        let emailOk = false;
        let smsOk = false;

        if (student.email) {
          const res = await sendEmail(smtpConfig, {
            to: student.email,
            subject,
            text,
          });
          if (res.success) {
            results.emailsSent++;
            emailOk = true;
          } else {
            results.emailsFailed++;
            results.errors.push(`Email to ${student.name}: ${res.error}`);
          }
        }

        if (includeSms && student.phone) {
          const smsBody = `Welcome to ${settings.courseName}! I'm ${settings.teacherName}. Check your email for course details.`;
          const res = await sendSms(smsConfig, {
            to: student.phone,
            body: smsBody,
          });
          if (res.success) {
            results.smsSent++;
            smsOk = true;
          } else {
            results.smsFailed++;
            results.errors.push(`SMS to ${student.name}: ${res.error}`);
          }
        }

        results.details.push({
          student: student.name,
          email: emailOk,
          sms: smsOk,
        });
      }

      if (includeAnnouncement) {
        try {
          const announcementVars = {
            studentName: "Everyone",
            teacherName: settings.teacherName,
            courseName: settings.courseName,
          };
          const announcementBody = renderTemplate(
            template.body,
            announcementVars
          );
          await postAnnouncement(
            settings.canvasBaseUrl,
            settings.canvasToken,
            settings.courseId,
            `Welcome to ${settings.courseName}!`,
            announcementBody.replace(/\n/g, "<br>")
          );
          results.announcementPosted = true;
        } catch (err: any) {
          results.errors.push(`Announcement: ${err?.message}`);
        }
      }
    }

    // ---- EVALUATION ----
    if (emailType === "evaluation") {
      for (const student of students) {
        const report = await getStudentGradeReport(
          settings.canvasBaseUrl,
          settings.canvasToken,
          settings.courseId,
          student,
          daysBack,
          daysForward
        );

        const missingSection =
          report.missingAssignments.length > 0
            ? `Missing Assignments:\n${formatAssignmentList(report.missingAssignments)}`
            : "Missing Assignments: None - Great job keeping up!";

        const upcomingSection =
          report.upcomingAssignments.length > 0
            ? `Upcoming Assignments:\n${formatAssignmentList(report.upcomingAssignments)}`
            : "Upcoming Assignments: None due in the next " +
              daysForward +
              " days.";

        const vars = {
          studentName: student.name.split(" ")[0],
          teacherName: settings.teacherName,
          courseName: settings.courseName,
          currentGrade: report.currentGrade || "N/A",
          currentScore: report.currentScore !== null
            ? String(report.currentScore)
            : "N/A",
          missingSection,
          upcomingSection,
          missingAssignmentList: formatAssignmentList(
            report.missingAssignments
          ),
          assignmentList: formatAssignmentList(report.upcomingAssignments),
        };

        const subject = renderTemplate(template.subject, vars);
        const text = renderTemplate(template.body, vars);

        let emailOk = false;
        let smsOk = false;

        if (student.email) {
          const res = await sendEmail(smtpConfig, {
            to: student.email,
            subject,
            text,
          });
          if (res.success) {
            results.emailsSent++;
            emailOk = true;
          } else {
            results.emailsFailed++;
            results.errors.push(`Email to ${student.name}: ${res.error}`);
          }
        }

        if (includeSms && student.phone) {
          const scoreStr =
            report.currentScore !== null
              ? `${report.currentScore}%`
              : "N/A";
          const smsBody = `${settings.teacherName}: Your current score in ${settings.courseName} is ${scoreStr}. Check your email for a full evaluation.`;
          const res = await sendSms(smsConfig, {
            to: student.phone,
            body: smsBody,
          });
          if (res.success) {
            results.smsSent++;
            smsOk = true;
          } else {
            results.smsFailed++;
            results.errors.push(`SMS to ${student.name}: ${res.error}`);
          }
        }

        results.details.push({
          student: student.name,
          email: emailOk,
          sms: smsOk,
        });
      }

      if (includeAnnouncement) {
        try {
          await postAnnouncement(
            settings.canvasBaseUrl,
            settings.canvasToken,
            settings.courseId,
            "Grade Evaluation Update",
            `Hi everyone, I've sent out individual evaluation emails with your current standing in ${settings.courseName}. Please check your inbox and reach out if you have questions. - ${settings.teacherName}`
          );
          results.announcementPosted = true;
        } catch (err: any) {
          results.errors.push(`Announcement: ${err?.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      emailType,
      ...results,
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to send emails" },
      { status: 500 }
    );
  }
}
