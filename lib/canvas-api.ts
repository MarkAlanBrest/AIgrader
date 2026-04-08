/**
 * Canvas LMS API utility library
 * Handles fetching students, assignments, grades, and missing work from Canvas
 */

export interface CanvasStudent {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
}

export interface CanvasSubmission {
  assignment_id: number;
  user_id: number;
  score: number | null;
  grade: string | null;
  workflow_state: string;
  missing: boolean;
  late: boolean;
  submitted_at: string | null;
}

export interface CanvasEnrollment {
  user_id: number;
  user: {
    id: number;
    name: string;
    email?: string;
    login_id?: string;
  };
  grades?: {
    current_score: number | null;
    current_grade: string | null;
    final_score: number | null;
    final_grade: string | null;
  };
}

export interface StudentGradeReport {
  student: CanvasStudent;
  currentScore: number | null;
  currentGrade: string | null;
  missingAssignments: CanvasAssignment[];
  upcomingAssignments: CanvasAssignment[];
  submissions: CanvasSubmission[];
}

async function canvasFetch(
  baseUrl: string,
  token: string,
  endpoint: string
): Promise<any[]> {
  const results: any[] = [];
  let url = `${baseUrl}/api/v1${endpoint}`;
  const separator = url.includes("?") ? "&" : "?";
  url += `${separator}per_page=100`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      results.push(...data);
    } else {
      results.push(data);
    }

    // Handle pagination via Link header
    const linkHeader = res.headers.get("Link") || "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : "";
  }

  return results;
}

/**
 * Get all students enrolled in a course
 */
export async function getStudents(
  baseUrl: string,
  token: string,
  courseId: string
): Promise<CanvasStudent[]> {
  const enrollments = await canvasFetch(
    baseUrl,
    token,
    `/courses/${courseId}/enrollments?type[]=StudentEnrollment&state[]=active`
  );

  return enrollments.map((e: any) => ({
    id: e.user_id || e.user?.id,
    name: e.user?.name || "Unknown",
    email: e.user?.email || e.user?.login_id || "",
    phone: e.user?.phone || undefined,
  }));
}

/**
 * Get all assignments for a course
 */
export async function getAssignments(
  baseUrl: string,
  token: string,
  courseId: string
): Promise<CanvasAssignment[]> {
  const assignments = await canvasFetch(
    baseUrl,
    token,
    `/courses/${courseId}/assignments?order_by=due_at`
  );

  return assignments.map((a: any) => ({
    id: a.id,
    name: a.name || "Untitled Assignment",
    due_at: a.due_at || null,
    points_possible: a.points_possible || 0,
    html_url: a.html_url || "",
  }));
}

/**
 * Get upcoming assignments within N days from now
 */
export async function getUpcomingAssignments(
  baseUrl: string,
  token: string,
  courseId: string,
  daysForward: number = 7
): Promise<CanvasAssignment[]> {
  const assignments = await getAssignments(baseUrl, token, courseId);
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000);

  return assignments.filter((a) => {
    if (!a.due_at) return false;
    const dueDate = new Date(a.due_at);
    return dueDate >= now && dueDate <= futureDate;
  });
}

/**
 * Get submissions for a specific student in a course
 */
export async function getStudentSubmissions(
  baseUrl: string,
  token: string,
  courseId: string,
  studentId: number
): Promise<CanvasSubmission[]> {
  const submissions = await canvasFetch(
    baseUrl,
    token,
    `/courses/${courseId}/students/submissions?student_ids[]=${studentId}`
  );

  return submissions.map((s: any) => ({
    assignment_id: s.assignment_id,
    user_id: s.user_id,
    score: s.score,
    grade: s.grade,
    workflow_state: s.workflow_state,
    missing: s.missing || false,
    late: s.late || false,
    submitted_at: s.submitted_at || null,
  }));
}

/**
 * Get missing assignments for a student within the last N days
 */
export async function getMissingAssignments(
  baseUrl: string,
  token: string,
  courseId: string,
  studentId: number,
  daysBack: number = 14
): Promise<CanvasAssignment[]> {
  const assignments = await getAssignments(baseUrl, token, courseId);
  const submissions = await getStudentSubmissions(baseUrl, token, courseId, studentId);

  const now = new Date();
  const pastDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const missingSubmissions = submissions.filter((s) => s.missing);
  const missingAssignmentIds = new Set(missingSubmissions.map((s) => s.assignment_id));

  return assignments.filter((a) => {
    if (!missingAssignmentIds.has(a.id)) return false;
    if (!a.due_at) return true;
    const dueDate = new Date(a.due_at);
    return dueDate >= pastDate && dueDate <= now;
  });
}

/**
 * Get enrollments with grades for a course
 */
export async function getEnrollmentsWithGrades(
  baseUrl: string,
  token: string,
  courseId: string
): Promise<CanvasEnrollment[]> {
  return canvasFetch(
    baseUrl,
    token,
    `/courses/${courseId}/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores`
  );
}

/**
 * Get a full grade report for a student
 */
export async function getStudentGradeReport(
  baseUrl: string,
  token: string,
  courseId: string,
  student: CanvasStudent,
  daysBack: number = 14,
  daysForward: number = 7
): Promise<StudentGradeReport> {
  const [enrollments, missingAssignments, upcomingAssignments, submissions] =
    await Promise.all([
      getEnrollmentsWithGrades(baseUrl, token, courseId),
      getMissingAssignments(baseUrl, token, courseId, student.id, daysBack),
      getUpcomingAssignments(baseUrl, token, courseId, daysForward),
      getStudentSubmissions(baseUrl, token, courseId, student.id),
    ]);

  const enrollment = enrollments.find(
    (e) => e.user_id === student.id || e.user?.id === student.id
  );

  return {
    student,
    currentScore: enrollment?.grades?.current_score ?? null,
    currentGrade: enrollment?.grades?.current_grade ?? null,
    missingAssignments,
    upcomingAssignments,
    submissions,
  };
}

/**
 * Post an announcement to a Canvas course
 */
export async function postAnnouncement(
  baseUrl: string,
  token: string,
  courseId: string,
  title: string,
  message: string
): Promise<any> {
  const res = await fetch(
    `${baseUrl}/api/v1/courses/${courseId}/discussion_topics`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        message,
        is_announcement: true,
        published: true,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas announcement error (${res.status}): ${text}`);
  }

  return res.json();
}
