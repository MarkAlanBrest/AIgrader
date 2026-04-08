/**
 * Email template storage and management
 * Templates use placeholders: {{studentName}}, {{teacherName}}, {{assignmentList}},
 * {{missingAssignmentList}}, {{currentGrade}}, {{currentScore}}, {{upcomingAssignmentList}}, {{courseName}}
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  upcoming: {
    id: "upcoming",
    name: "Upcoming Assignments",
    subject: "Upcoming Assignments - {{courseName}}",
    body: `Dear {{studentName}},

I hope this message finds you well. This is a friendly reminder from {{teacherName}} about your upcoming assignments in {{courseName}}.

The following assignments are due in the next {{daysForward}} days:

{{assignmentList}}

Please make sure to submit your work on time. If you have any questions or need help, don't hesitate to reach out to me.

Best regards,
{{teacherName}}`,
  },

  missing: {
    id: "missing",
    name: "Missing Work Reminder",
    subject: "Missing Assignments - {{courseName}}",
    body: `Dear {{studentName}},

This is {{teacherName}} reaching out about some missing work in {{courseName}}.

According to my records, the following assignments from the past {{daysBack}} days have not been submitted:

{{missingAssignmentList}}

I encourage you to complete and submit these assignments as soon as possible. Late submissions are still better than missing work. Please reach out if you need any assistance or if there are circumstances I should be aware of.

Sincerely,
{{teacherName}}`,
  },

  welcome: {
    id: "welcome",
    name: "Welcome to Class",
    subject: "Welcome to {{courseName}}!",
    body: `Dear {{studentName}},

Welcome to {{courseName}}! I'm {{teacherName}}, and I'm excited to have you in class this term.

I want to take a moment to introduce myself and let you know that I'm here to support your learning journey. Please don't hesitate to reach out if you have any questions about the course, assignments, or anything else.

Here are a few things to get started:
- Check Canvas regularly for announcements and assignment updates
- Review the course syllabus and schedule
- Reach out early if you need help or accommodations

I look forward to a great semester together!

Warm regards,
{{teacherName}}`,
  },

  evaluation: {
    id: "evaluation",
    name: "Student Evaluation",
    subject: "Your Progress in {{courseName}}",
    body: `Dear {{studentName}},

This is {{teacherName}} with an update on your progress in {{courseName}}.

Current Standing:
- Current Grade: {{currentGrade}}
- Current Score: {{currentScore}}%

{{missingSection}}

{{upcomingSection}}

If you have questions about your grade or need help with any assignments, please don't hesitate to reach out. I'm here to help you succeed.

Best regards,
{{teacherName}}`,
  },
};

/**
 * Replace template placeholders with actual values
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Format a list of assignments as a readable string
 */
export function formatAssignmentList(
  assignments: { name: string; due_at: string | null; points_possible: number }[]
): string {
  if (assignments.length === 0) return "  No assignments found.";

  return assignments
    .map((a) => {
      const dueStr = a.due_at
        ? new Date(a.due_at).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "No due date";
      return `  - ${a.name} (Due: ${dueStr}, ${a.points_possible} pts)`;
    })
    .join("\n");
}
