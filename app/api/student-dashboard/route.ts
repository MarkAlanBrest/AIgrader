export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
  has_submitted_submissions?: boolean;
  submission?: {
    submitted_at: string | null;
    workflow_state: string;
    score: number | null;
    late: boolean;
    missing: boolean;
  };
}

interface CanvasUser {
  id: number;
  name: string;
  short_name?: string;
  sortable_name?: string;
  email?: string;
}

interface DashboardAssignment {
  id: number;
  name: string;
  dueAt: string;
  pointsPossible: number | null;
  url: string;
  status: "past_due" | "upcoming" | "submitted" | "graded";
  score: number | null;
  submittedAt: string | null;
}

interface DashboardResponse {
  studentName: string;
  teacherName: string;
  courseName: string;
  pastDueAssignments: DashboardAssignment[];
  upcomingAssignments: DashboardAssignment[];
  daysBack: number;
  daysForward: number;
  error?: string;
}

async function canvasFetch(baseUrl: string, token: string, path: string) {
  const url = `${baseUrl}/api/v1${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const courseId = searchParams.get("courseId");
    const studentId = searchParams.get("studentId");
    const daysBack = parseInt(searchParams.get("daysBack") || "14", 10);
    const daysForward = parseInt(searchParams.get("daysForward") || "14", 10);

    const token = process.env.CANVAS_API_TOKEN;
    const baseUrl = (process.env.CANVAS_BASE_URL || "").replace(/\/+$/, "");

    if (!token || !baseUrl) {
      return Response.json(
        {
          error:
            "Missing CANVAS_API_TOKEN or CANVAS_BASE_URL environment variables.",
        } as DashboardResponse,
        { status: 500 }
      );
    }

    if (!courseId) {
      return Response.json(
        { error: "Missing required query parameter: courseId" } as DashboardResponse,
        { status: 400 }
      );
    }

    // Calculate date boundaries
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - daysBack);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysForward);

    // Fetch student info
    let studentName = "Student";
    if (studentId) {
      try {
        const student: CanvasUser = await canvasFetch(
          baseUrl,
          token,
          `/courses/${courseId}/users/${studentId}`
        );
        studentName = student.short_name || student.name || "Student";
      } catch {
        // If we can't get the student, use default
        studentName = "Student";
      }
    }

    // Fetch course info (for course name)
    let courseName = "Course";
    try {
      const course = await canvasFetch(
        baseUrl,
        token,
        `/courses/${courseId}`
      );
      courseName = course.name || "Course";
    } catch {
      courseName = "Course";
    }

    // Fetch teachers
    let teacherName = "Instructor";
    try {
      const teachers: CanvasUser[] = await canvasFetch(
        baseUrl,
        token,
        `/courses/${courseId}/users?enrollment_type[]=teacher&per_page=5`
      );
      if (teachers.length > 0) {
        teacherName = teachers
          .map((t) => t.short_name || t.name)
          .join(", ");
      }
    } catch {
      teacherName = "Instructor";
    }

    // Fetch assignments with submissions for this student
    let assignmentsPath = `/courses/${courseId}/assignments?per_page=100&order_by=due_at`;
    if (studentId) {
      assignmentsPath += `&include[]=submission`;
    }

    let assignments: CanvasAssignment[] = [];
    try {
      assignments = await canvasFetch(baseUrl, token, assignmentsPath);
    } catch {
      assignments = [];
    }

    // Filter and categorize assignments
    const pastDueAssignments: DashboardAssignment[] = [];
    const upcomingAssignments: DashboardAssignment[] = [];

    for (const a of assignments) {
      if (!a.due_at) continue;

      const dueDate = new Date(a.due_at);

      // Skip assignments outside our date range
      if (dueDate < pastDate || dueDate > futureDate) continue;

      const submission = a.submission;
      const isSubmitted =
        submission &&
        submission.workflow_state !== "unsubmitted" &&
        submission.submitted_at !== null;
      const isGraded =
        submission && submission.workflow_state === "graded";

      let status: DashboardAssignment["status"];
      if (dueDate < now && !isSubmitted) {
        status = "past_due";
      } else if (isGraded) {
        status = "graded";
      } else if (isSubmitted) {
        status = "submitted";
      } else {
        status = "upcoming";
      }

      const dashboardAssignment: DashboardAssignment = {
        id: a.id,
        name: a.name,
        dueAt: a.due_at,
        pointsPossible: a.points_possible,
        url: a.html_url,
        status,
        score: submission?.score ?? null,
        submittedAt: submission?.submitted_at ?? null,
      };

      if (status === "past_due") {
        pastDueAssignments.push(dashboardAssignment);
      } else {
        upcomingAssignments.push(dashboardAssignment);
      }
    }

    // Sort: past due by most recent first, upcoming by soonest first
    pastDueAssignments.sort(
      (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    );
    upcomingAssignments.sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );

    const response: DashboardResponse = {
      studentName,
      teacherName,
      courseName,
      pastDueAssignments,
      upcomingAssignments,
      daysBack,
      daysForward,
    };

    return Response.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Server error: ${message}` } as DashboardResponse,
      { status: 500 }
    );
  }
}
