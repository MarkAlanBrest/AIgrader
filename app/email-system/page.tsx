"use client";

import { useEffect, useState } from "react";

// ---------- TYPES ----------
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Settings {
  canvasBaseUrl: string;
  canvasToken: string;
  courseId: string;
  teacherName: string;
  teacherEmail: string;
  courseName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  twilioSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  daysForward: number;
  daysBack: number;
}

interface SendResult {
  success: boolean;
  emailType: string;
  emailsSent: number;
  emailsFailed: number;
  smsSent: number;
  smsFailed: number;
  announcementPosted: boolean;
  errors: string[];
  details: { student: string; email: boolean; sms: boolean }[];
}

type Tab = "send" | "templates" | "settings";
type EmailType = "upcoming" | "missing" | "welcome" | "evaluation";

const EMAIL_TYPES: { id: EmailType; label: string; description: string; icon: string }[] = [
  {
    id: "upcoming",
    label: "Upcoming Assignments",
    description: "Notify students about assignments due soon",
    icon: "📅",
  },
  {
    id: "missing",
    label: "Missing Work Reminder",
    description: "Remind students about missing assignments",
    icon: "⚠️",
  },
  {
    id: "welcome",
    label: "Welcome to Class",
    description: "Send a welcome email to all students",
    icon: "👋",
  },
  {
    id: "evaluation",
    label: "Student Evaluation",
    description: "Send grade reports and class standing",
    icon: "📊",
  },
];

// ---------- COMPONENT ----------
export default function EmailSystem() {
  const [activeTab, setActiveTab] = useState<Tab>("send");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  // Send form state
  const [selectedEmailType, setSelectedEmailType] = useState<EmailType>("upcoming");
  const [includeAnnouncement, setIncludeAnnouncement] = useState(false);
  const [includeSms, setIncludeSms] = useState(false);
  const [daysForward, setDaysForward] = useState(7);
  const [daysBack, setDaysBack] = useState(14);

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<EmailType | null>(null);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  // ---------- LOAD DATA ----------
  useEffect(() => {
    loadSettings();
    loadTemplates();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/email-system/settings");
      const data = await res.json();
      if (!data.error) setSettings(data);
    } catch {
      // settings not loaded yet
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/email-system/templates");
      const data = await res.json();
      if (!data.error) setTemplates(data);
    } catch {
      // templates not loaded yet
    }
  }

  // ---------- SETTINGS ----------
  async function saveSettingsHandler() {
    if (!settings) return;
    setLoading(true);
    setStatusMessage("");

    try {
      const res = await fetch("/api/email-system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage("Settings saved successfully!");
        setStatusType("success");
      } else {
        setStatusMessage(data.error || "Failed to save settings");
        setStatusType("error");
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to save");
      setStatusType("error");
    }
    setLoading(false);
  }

  // ---------- TEMPLATES ----------
  function startEditTemplate(type: EmailType) {
    const tmpl = templates[type];
    if (tmpl) {
      setEditingTemplate(type);
      setTemplateSubject(tmpl.subject);
      setTemplateBody(tmpl.body);
      setPreviewHtml("");
    }
  }

  async function saveTemplateHandler() {
    if (!editingTemplate) return;
    setLoading(true);

    try {
      const res = await fetch("/api/email-system/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplate,
          name: templates[editingTemplate]?.name || editingTemplate,
          subject: templateSubject,
          body: templateBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        setStatusMessage("Template saved!");
        setStatusType("success");
        setEditingTemplate(null);
      } else {
        setStatusMessage(data.error || "Failed to save template");
        setStatusType("error");
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to save template");
      setStatusType("error");
    }
    setLoading(false);
  }

  async function previewTemplate() {
    if (!editingTemplate) return;
    try {
      const res = await fetch("/api/email-system/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailType: editingTemplate }),
      });
      const data = await res.json();
      if (data.html) {
        setPreviewHtml(data.html);
      }
    } catch {
      // preview failed
    }
  }

  // ---------- SEND EMAILS ----------
  async function sendEmails() {
    setSendLoading(true);
    setStatusMessage("");
    setSendResult(null);

    try {
      const res = await fetch("/api/email-system/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType: selectedEmailType,
          includeAnnouncement,
          includeSms,
          daysForward,
          daysBack,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setStatusMessage(data.error);
        setStatusType("error");
      } else {
        setSendResult(data);
        setStatusMessage(
          `Sent ${data.emailsSent} email(s)${data.smsSent > 0 ? `, ${data.smsSent} SMS` : ""}${data.announcementPosted ? ", announcement posted" : ""}`
        );
        setStatusType("success");
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to send emails");
      setStatusType("error");
    }
    setSendLoading(false);
  }

  // ---------- HELPERS ----------
  function updateSetting(key: keyof Settings, value: string | number) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  // ---------- STYLES ----------
  const colors = {
    primary: "#1e40af",
    primaryLight: "#3b82f6",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    bg: "#f8fafc",
    cardBg: "#ffffff",
    border: "#e2e8f0",
    text: "#1e293b",
    textLight: "#64748b",
  };

  const tabStyle = (active: boolean) => ({
    padding: "12px 24px",
    border: "none",
    borderBottom: active ? `3px solid ${colors.primary}` : "3px solid transparent",
    background: "transparent",
    color: active ? colors.primary : colors.textLight,
    fontWeight: active ? 700 : 500,
    fontSize: 15,
    cursor: "pointer" as const,
  });

  const cardStyle = {
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    fontSize: 14,
    color: colors.text,
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: 13,
    fontWeight: 600,
    color: colors.textLight,
    marginBottom: 4,
    marginTop: 14,
  };

  const btnPrimary = {
    padding: "12px 28px",
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer" as const,
  };

  const btnSecondary = {
    padding: "10px 20px",
    background: "#f1f5f9",
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer" as const,
  };

  // ---------- RENDER ----------
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* HEADER */}
      <div
        style={{
          background: colors.primary,
          color: "#fff",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Canvas Email System</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.85, fontSize: 14 }}>
            Send personalized emails, announcements, and texts to your students
          </p>
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          background: colors.cardBg,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          paddingLeft: 32,
        }}
      >
        <button style={tabStyle(activeTab === "send")} onClick={() => setActiveTab("send")}>
          Send Emails
        </button>
        <button style={tabStyle(activeTab === "templates")} onClick={() => setActiveTab("templates")}>
          Email Templates
        </button>
        <button style={tabStyle(activeTab === "settings")} onClick={() => setActiveTab("settings")}>
          Settings
        </button>
      </div>

      {/* STATUS BAR */}
      {statusMessage && (
        <div
          style={{
            margin: "16px 32px 0",
            padding: "12px 20px",
            borderRadius: 8,
            background:
              statusType === "success"
                ? "#d1fae5"
                : statusType === "error"
                ? "#fee2e2"
                : "#e0f2fe",
            color:
              statusType === "success"
                ? "#065f46"
                : statusType === "error"
                ? "#991b1b"
                : "#0c4a6e",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage("")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "inherit" }}
          >
            x
          </button>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ padding: "24px 32px", maxWidth: 1000 }}>
        {/* ============ SEND TAB ============ */}
        {activeTab === "send" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: colors.text }}>
              Choose Email Type
            </h2>

            {/* EMAIL TYPE CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {EMAIL_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedEmailType(type.id)}
                  style={{
                    ...cardStyle,
                    cursor: "pointer",
                    textAlign: "left" as const,
                    borderColor:
                      selectedEmailType === type.id ? colors.primary : colors.border,
                    borderWidth: selectedEmailType === type.id ? 2 : 1,
                    boxShadow:
                      selectedEmailType === type.id
                        ? `0 0 0 3px ${colors.primary}22`
                        : "none",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{type.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
                    {type.label}
                  </div>
                  <div style={{ fontSize: 13, color: colors.textLight, marginTop: 4 }}>
                    {type.description}
                  </div>
                </button>
              ))}
            </div>

            {/* OPTIONS */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Options
              </h3>

              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" as const }}>
                {(selectedEmailType === "upcoming" || selectedEmailType === "evaluation") && (
                  <div>
                    <label style={labelStyle}>Days Forward</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={daysForward}
                      onChange={(e) => setDaysForward(Number(e.target.value))}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </div>
                )}
                {(selectedEmailType === "missing" || selectedEmailType === "evaluation") && (
                  <div>
                    <label style={labelStyle}>Days Back</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={daysBack}
                      onChange={(e) => setDaysBack(Number(e.target.value))}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 28 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeAnnouncement}
                    onChange={(e) => setIncludeAnnouncement(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: colors.primary }}
                  />
                  Also post as Canvas Announcement
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeSms}
                    onChange={(e) => setIncludeSms(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: colors.primary }}
                  />
                  Also send Text Message (if phone number listed)
                </label>
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  onClick={sendEmails}
                  disabled={sendLoading}
                  style={{
                    ...btnPrimary,
                    opacity: sendLoading ? 0.6 : 1,
                    minWidth: 200,
                  }}
                >
                  {sendLoading ? "Sending..." : `Send ${EMAIL_TYPES.find((t) => t.id === selectedEmailType)?.label} Emails`}
                </button>
              </div>
            </div>

            {/* SEND RESULTS */}
            {sendResult && (
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                  Send Results
                </h3>

                <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                  <div
                    style={{
                      background: "#d1fae5",
                      padding: "12px 20px",
                      borderRadius: 8,
                      textAlign: "center" as const,
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#065f46" }}>
                      {sendResult.emailsSent}
                    </div>
                    <div style={{ fontSize: 12, color: "#065f46" }}>Emails Sent</div>
                  </div>
                  {sendResult.emailsFailed > 0 && (
                    <div
                      style={{
                        background: "#fee2e2",
                        padding: "12px 20px",
                        borderRadius: 8,
                        textAlign: "center" as const,
                      }}
                    >
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#991b1b" }}>
                        {sendResult.emailsFailed}
                      </div>
                      <div style={{ fontSize: 12, color: "#991b1b" }}>Emails Failed</div>
                    </div>
                  )}
                  {sendResult.smsSent > 0 && (
                    <div
                      style={{
                        background: "#e0f2fe",
                        padding: "12px 20px",
                        borderRadius: 8,
                        textAlign: "center" as const,
                      }}
                    >
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#0c4a6e" }}>
                        {sendResult.smsSent}
                      </div>
                      <div style={{ fontSize: 12, color: "#0c4a6e" }}>SMS Sent</div>
                    </div>
                  )}
                  {sendResult.announcementPosted && (
                    <div
                      style={{
                        background: "#fef3c7",
                        padding: "12px 20px",
                        borderRadius: 8,
                        textAlign: "center" as const,
                      }}
                    >
                      <div style={{ fontSize: 28 }}>&#10003;</div>
                      <div style={{ fontSize: 12, color: "#92400e" }}>Announcement Posted</div>
                    </div>
                  )}
                </div>

                {sendResult.errors.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.danger, marginBottom: 6 }}>
                      Errors:
                    </div>
                    {sendResult.errors.map((err, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#991b1b", marginBottom: 2 }}>
                        {err}
                      </div>
                    ))}
                  </div>
                )}

                {sendResult.details.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.textLight, marginBottom: 8 }}>
                      Student Details:
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left" as const, borderBottom: `1px solid ${colors.border}` }}>
                            Student
                          </th>
                          <th style={{ padding: "8px 12px", textAlign: "center" as const, borderBottom: `1px solid ${colors.border}` }}>
                            Email
                          </th>
                          <th style={{ padding: "8px 12px", textAlign: "center" as const, borderBottom: `1px solid ${colors.border}` }}>
                            SMS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendResult.details.map((d, i) => (
                          <tr key={i}>
                            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}` }}>
                              {d.student}
                            </td>
                            <td
                              style={{
                                padding: "8px 12px",
                                textAlign: "center" as const,
                                borderBottom: `1px solid ${colors.border}`,
                                color: d.email ? colors.success : colors.textLight,
                              }}
                            >
                              {d.email ? "Sent" : "-"}
                            </td>
                            <td
                              style={{
                                padding: "8px 12px",
                                textAlign: "center" as const,
                                borderBottom: `1px solid ${colors.border}`,
                                color: d.sms ? colors.success : colors.textLight,
                              }}
                            >
                              {d.sms ? "Sent" : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ TEMPLATES TAB ============ */}
        {activeTab === "templates" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: colors.text }}>
              Email Templates
            </h2>
            <p style={{ fontSize: 14, color: colors.textLight, marginBottom: 20 }}>
              Customize the email templates sent to students. Use placeholders like{" "}
              <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                {"{{studentName}}"}
              </code>
              ,{" "}
              <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                {"{{teacherName}}"}
              </code>
              ,{" "}
              <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                {"{{courseName}}"}
              </code>
              , and more.
            </p>

            {!editingTemplate ? (
              <div style={{ display: "grid", gap: 12 }}>
                {EMAIL_TYPES.map((type) => {
                  const tmpl = templates[type.id];
                  return (
                    <div key={type.id} style={cardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
                            {type.icon} {type.label}
                          </div>
                          <div style={{ fontSize: 13, color: colors.textLight, marginTop: 4 }}>
                            Subject: {tmpl?.subject || "Not set"}
                          </div>
                        </div>
                        <button style={btnSecondary} onClick={() => startEditTemplate(type.id)}>
                          Edit Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>
                    Editing: {templates[editingTemplate]?.name || editingTemplate}
                  </h3>
                  <button style={btnSecondary} onClick={() => setEditingTemplate(null)}>
                    Cancel
                  </button>
                </div>

                <label style={labelStyle}>Subject Line</label>
                <input
                  type="text"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  style={inputStyle}
                />

                <label style={labelStyle}>Email Body</label>
                <textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={16}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
                />

                <div style={{ marginTop: 8, fontSize: 12, color: colors.textLight }}>
                  Available placeholders:{" "}
                  {[
                    "studentName",
                    "teacherName",
                    "courseName",
                    "assignmentList",
                    "missingAssignmentList",
                    "currentGrade",
                    "currentScore",
                    "daysForward",
                    "daysBack",
                    "missingSection",
                    "upcomingSection",
                  ].map((p) => (
                    <code
                      key={p}
                      style={{
                        background: "#f1f5f9",
                        padding: "1px 5px",
                        borderRadius: 3,
                        marginRight: 6,
                        fontSize: 11,
                      }}
                    >
                      {`{{${p}}}`}
                    </code>
                  ))}
                </div>

                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                  <button style={btnPrimary} onClick={saveTemplateHandler} disabled={loading}>
                    {loading ? "Saving..." : "Save Template"}
                  </button>
                  <button style={btnSecondary} onClick={previewTemplate}>
                    Preview with Sample Data
                  </button>
                </div>

                {previewHtml && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: colors.textLight }}>
                      Preview:
                    </h4>
                    <div
                      style={{
                        background: "#fff",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: 20,
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: colors.text,
                      }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ SETTINGS TAB ============ */}
        {activeTab === "settings" && settings && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: colors.text }}>
              Settings
            </h2>

            {/* Canvas Settings */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Canvas LMS Configuration
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label style={labelStyle}>Canvas Base URL</label>
                  <input
                    type="text"
                    value={settings.canvasBaseUrl}
                    onChange={(e) => updateSetting("canvasBaseUrl", e.target.value)}
                    placeholder="https://yourschool.instructure.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Canvas API Token</label>
                  <input
                    type="password"
                    value={settings.canvasToken}
                    onChange={(e) => updateSetting("canvasToken", e.target.value)}
                    placeholder="Enter Canvas API token"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Course ID</label>
                  <input
                    type="text"
                    value={settings.courseId}
                    onChange={(e) => updateSetting("courseId", e.target.value)}
                    placeholder="12345"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Course Name</label>
                  <input
                    type="text"
                    value={settings.courseName}
                    onChange={(e) => updateSetting("courseName", e.target.value)}
                    placeholder="Introduction to Computer Science"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Teacher Info */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Teacher Information
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label style={labelStyle}>Teacher Name</label>
                  <input
                    type="text"
                    value={settings.teacherName}
                    onChange={(e) => updateSetting("teacherName", e.target.value)}
                    placeholder="Professor Smith"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Teacher Email</label>
                  <input
                    type="email"
                    value={settings.teacherEmail}
                    onChange={(e) => updateSetting("teacherEmail", e.target.value)}
                    placeholder="teacher@school.edu"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Email/SMTP Settings */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Email (SMTP) Configuration
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label style={labelStyle}>SMTP Host</label>
                  <input
                    type="text"
                    value={settings.smtpHost}
                    onChange={(e) => updateSetting("smtpHost", e.target.value)}
                    placeholder="smtp.gmail.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SMTP Port</label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) => updateSetting("smtpPort", Number(e.target.value))}
                    placeholder="587"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SMTP Username</label>
                  <input
                    type="text"
                    value={settings.smtpUser}
                    onChange={(e) => updateSetting("smtpUser", e.target.value)}
                    placeholder="your@email.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SMTP Password</label>
                  <input
                    type="password"
                    value={settings.smtpPass}
                    onChange={(e) => updateSetting("smtpPass", e.target.value)}
                    placeholder="App password"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>From Email Address</label>
                  <input
                    type="email"
                    value={settings.smtpFrom}
                    onChange={(e) => updateSetting("smtpFrom", e.target.value)}
                    placeholder="noreply@school.edu"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Twilio / SMS Settings */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Text Message (Twilio) Configuration
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label style={labelStyle}>Twilio Account SID</label>
                  <input
                    type="text"
                    value={settings.twilioSid}
                    onChange={(e) => updateSetting("twilioSid", e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Twilio Auth Token</label>
                  <input
                    type="password"
                    value={settings.twilioAuthToken}
                    onChange={(e) => updateSetting("twilioAuthToken", e.target.value)}
                    placeholder="Enter Twilio auth token"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Twilio Phone Number</label>
                  <input
                    type="text"
                    value={settings.twilioPhoneNumber}
                    onChange={(e) => updateSetting("twilioPhoneNumber", e.target.value)}
                    placeholder="+1234567890"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Default Days */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: colors.text }}>
                Default Time Ranges
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label style={labelStyle}>Days Forward (Upcoming Assignments)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={settings.daysForward}
                    onChange={(e) => updateSetting("daysForward", Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Days Back (Missing Work)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={settings.daysBack}
                    onChange={(e) => updateSetting("daysBack", Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveSettingsHandler}
              disabled={loading}
              style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Saving..." : "Save All Settings"}
            </button>
          </div>
        )}

        {activeTab === "settings" && !settings && (
          <div style={{ textAlign: "center" as const, padding: 40, color: colors.textLight }}>
            Loading settings...
          </div>
        )}
      </div>
    </div>
  );
}
