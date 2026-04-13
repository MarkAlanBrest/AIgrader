"use client";

import { useEffect, useState } from "react";

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

interface DashboardData {
  studentName: string;
  teacherName: string;
  courseName: string;
  pastDueAssignments: DashboardAssignment[];
  upcomingAssignments: DashboardAssignment[];
  daysBack: number;
  daysForward: number;
  error?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): string {
  const now = new Date();
  const due = new Date(iso);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays === -1) return "1 day ago";
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Read config from URL query params
  const [config, setConfig] = useState<{
    courseId: string;
    studentId: string;
    daysBack: string;
    daysForward: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConfig({
      courseId: params.get("courseId") || "",
      studentId: params.get("studentId") || "",
      daysBack: params.get("daysBack") || "14",
      daysForward: params.get("daysForward") || "14",
    });
  }, []);

  useEffect(() => {
    if (!config) return;

    if (!config.courseId) {
      setError("Missing courseId parameter. Add ?courseId=YOUR_COURSE_ID to the URL.");
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      try {
        const params = new URLSearchParams();
        params.set("courseId", config!.courseId);
        if (config!.studentId) params.set("studentId", config!.studentId);
        params.set("daysBack", config!.daysBack);
        params.set("daysForward", config!.daysForward);

        const res = await fetch(`/api/student-dashboard?${params.toString()}`);
        const json = await res.json();

        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to load dashboard: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [config]);

  // ----- LOADING STATE -----
  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#6b7280",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32,
            height: 32,
            border: "3px solid #e5e7eb",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <p>Loading dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ----- ERROR STATE -----
  if (error) {
    return (
      <div style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          padding: 16,
          color: "#991b1b",
        }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Error</strong>
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ----- MAIN DASHBOARD -----
  return (
    <div style={{
      padding: 20,
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: 700,
      margin: "0 auto",
      color: "#111827",
      background: "#ffffff",
      minHeight: "100vh",
    }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 20,
        color: "#ffffff",
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
        }}>
          Welcome, {data.studentName}
        </h1>
        <p style={{
          margin: "6px 0 0",
          fontSize: 14,
          opacity: 0.9,
        }}>
          {data.courseName} &middot; Instructor: {data.teacherName}
        </p>
      </div>

      {/* Date Range Info */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        fontSize: 13,
        color: "#6b7280",
      }}>
        <span style={{
          background: "#f3f4f6",
          padding: "4px 10px",
          borderRadius: 20,
        }}>
          Past {data.daysBack} days
        </span>
        <span style={{
          background: "#f3f4f6",
          padding: "4px 10px",
          borderRadius: 20,
        }}>
          Next {data.daysForward} days
        </span>
      </div>

      {/* Past Due Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#dc2626",
          }} />
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#dc2626",
          }}>
            Past Due ({data.pastDueAssignments.length})
          </h2>
        </div>

        {data.pastDueAssignments.length === 0 ? (
          <div style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            color: "#166534",
          }}>
            No past due assignments. Great job!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.pastDueAssignments.map((a) => (
              <div
                key={a.id}
                style={{
                  border: "1px solid #fecaca",
                  borderLeft: "4px solid #dc2626",
                  borderRadius: 8,
                  padding: "12px 16px",
                  background: "#fffbfb",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}>
                  <div>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#111827",
                      marginBottom: 4,
                    }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Due: {formatDate(a.dueAt)} &middot; {daysUntil(a.dueAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {a.pointsPossible !== null && (
                      <div style={{
                        fontSize: 12,
                        color: "#9ca3af",
                      }}>
                        {a.pointsPossible} pts
                      </div>
                    )}
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#dc2626",
                      marginTop: 2,
                      background: "#fee2e2",
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}>
                      MISSING
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#2563eb",
          }} />
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#2563eb",
          }}>
            Upcoming ({data.upcomingAssignments.length})
          </h2>
        </div>

        {data.upcomingAssignments.length === 0 ? (
          <div style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            color: "#075985",
          }}>
            No upcoming assignments in the next {data.daysForward} days.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.upcomingAssignments.map((a) => {
              const isSubmitted = a.status === "submitted" || a.status === "graded";

              return (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${isSubmitted ? "#16a34a" : "#2563eb"}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    background: "#ffffff",
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}>
                    <div>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "#111827",
                        marginBottom: 4,
                      }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Due: {formatDate(a.dueAt)} &middot; {daysUntil(a.dueAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {a.pointsPossible !== null && (
                        <div style={{
                          fontSize: 12,
                          color: "#9ca3af",
                        }}>
                          {a.pointsPossible} pts
                        </div>
                      )}
                      {isSubmitted ? (
                        <div style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#16a34a",
                          marginTop: 2,
                          background: "#dcfce7",
                          padding: "2px 8px",
                          borderRadius: 10,
                        }}>
                          {a.status === "graded"
                            ? `GRADED ${a.score !== null ? `${a.score}/${a.pointsPossible}` : ""}`
                            : "SUBMITTED"}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#2563eb",
                          marginTop: 2,
                          background: "#dbeafe",
                          padding: "2px 8px",
                          borderRadius: 10,
                        }}>
                          TODO
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #e5e7eb",
        paddingTop: 12,
        fontSize: 11,
        color: "#9ca3af",
        textAlign: "center",
      }}>
        Assignment Dashboard &middot; Updated {new Date().toLocaleString()}
      </div>
    </div>
  );
}
