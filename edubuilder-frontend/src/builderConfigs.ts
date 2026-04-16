import type { BuilderConfig } from './types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const PIN = import.meta.env.VITE_APP_PIN || "";

export { BACKEND_URL, PIN };

export const CATEGORIES = ["Assignments", "Tests", "Lessons", "Presentation"] as const;

// NOTE: "teststudy", "notes", and "fillable" have been removed per user request
export const BUILDERS: Record<string, BuilderConfig> = {
  lab: {
    label: "Lab Project Builder",
    sub: "Structured lab with procedure, materials, and safety",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Lab Options",
    optionsSub: "Lab-specific settings",
    category: "Assignments",
    options: [
      { type: "select", key: "lab-type", label: "Lab Type", options: ["Wet Lab (hands-on)", "Dry Lab (analysis)", "Virtual / Simulation", "Field Lab"], defaultValue: "Wet Lab (hands-on)" },
      { type: "divider" },
      { type: "label", label: "Sections" },
      { type: "toggle", key: "lab-safety", label: "Safety warnings", defaultValue: true },
      { type: "toggle", key: "lab-materials", label: "Materials list", defaultValue: true },
      { type: "toggle", key: "lab-preq", label: "Pre-lab questions", defaultValue: true },
      { type: "toggle", key: "lab-tables", label: "Data tables", defaultValue: true },
      { type: "toggle", key: "lab-postq", label: "Post-lab analysis", defaultValue: true },
      { type: "toggle", key: "lab-conclusion", label: "Conclusion section", defaultValue: true },
      { type: "divider" },
      { type: "slider", key: "lab-steps", label: "Procedure steps", min: 3, max: 20, step: 1, defaultValue: 8 },
    ],
    systemPrompt: (opts) => `You are an expert curriculum developer creating a professional lab document for adult learners.
Create a complete, detailed lab document with the following sections based on the settings provided.
Return ONLY valid JSON in this exact structure:
{
  "title": "string",
  "objective": "string (2-3 sentences)",
  "safety": ["warning 1", "warning 2"] or null if disabled,
  "materials": ["item 1", "item 2"] or null if disabled,
  "background": "string (2-3 paragraphs of background theory)",
  "procedure": ["Step 1: ...", "Step 2: ..."] (${opts["lab-steps"] || 8} steps),
  "preLabQuestions": ["Q1", "Q2", "Q3"] or null if disabled,
  "dataSection": "string describing data tables needed" or null if disabled,
  "analysisQuestions": ["Q1", "Q2", "Q3", "Q4"] or null if disabled,
  "conclusion": "string (conclusion prompt paragraph)" or null if disabled
}`,
  },

  worksheet: {
    label: "Worksheet Builder",
    sub: "Practice problems, exercises, and activities",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Worksheet Options",
    optionsSub: "Question types and format",
    category: "Assignments",
    options: [
      { type: "label", label: "Question Types" },
      { type: "toggle", key: "ws-mc", label: "Multiple choice", defaultValue: true },
      { type: "toggle", key: "ws-tf", label: "True / False", defaultValue: true },
      { type: "toggle", key: "ws-sa", label: "Short answer", defaultValue: true },
      { type: "toggle", key: "ws-fill", label: "Fill in the blank", defaultValue: true },
      { type: "toggle", key: "ws-match", label: "Matching", defaultValue: false },
      { type: "toggle", key: "ws-essay", label: "Essay / long answer", defaultValue: false },
      { type: "divider" },
      { type: "slider", key: "ws-count", label: "Total questions", min: 5, max: 50, step: 1, defaultValue: 20 },
      { type: "divider" },
      { type: "label", label: "Output" },
      { type: "toggle", key: "ws-answerkey", label: "Include answer key", defaultValue: true },
      { type: "toggle", key: "ws-points", label: "Include point values", defaultValue: true },
      { type: "toggle", key: "ws-wordbank", label: "Word bank (fill-in)", defaultValue: true },
    ],
    systemPrompt: (opts) => `You are an expert curriculum developer creating a professional worksheet for adult learners.
Return ONLY valid JSON:
{
  "title": "string",
  "instructions": "string",
  "questions": [
    { "type": "mc|tf|sa|fill|match|essay", "number": 1, "question": "string", "options": ["A) ...", "B) ..."] or null, "answer": "string", "points": number }
  ],
  "wordBank": ["word1", "word2"] or null,
  "totalPoints": number
}
Generate ${opts["ws-count"] || 20} questions total.`,
  },

  studyguide: {
    label: "Study Guide Builder",
    sub: "Comprehensive review guide for learners",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Study Guide Options",
    optionsSub: "Format and content settings",
    category: "Assignments",
    options: [
      { type: "select", key: "sg-format", label: "Format", options: ["Outline with headers", "Q & A format", "Concept map style", "Cornell notes style"], defaultValue: "Outline with headers" },
      { type: "divider" },
      { type: "label", label: "Sections" },
      { type: "toggle", key: "sg-terms", label: "Key terms list", defaultValue: true },
      { type: "toggle", key: "sg-summary", label: "Summary section", defaultValue: true },
      { type: "toggle", key: "sg-pq", label: "Practice questions", defaultValue: true },
      { type: "toggle", key: "sg-tips", label: "Mnemonics / tips", defaultValue: true },
    ],
    systemPrompt: () => `You are an expert curriculum developer creating a comprehensive study guide for adult learners.
Return ONLY valid JSON:
{
  "title": "string",
  "overview": "string",
  "sections": [{ "heading": "string", "content": "string", "keyPoints": ["point 1", "point 2"] }],
  "keyTerms": [{"term": "string", "definition": "string"}],
  "summary": "string",
  "practiceQuestions": ["Q1?", "Q2?"],
  "tips": ["tip 1", "tip 2"]
}`,
  },

  terminology: {
    label: "Terminology Sheet",
    sub: "Key terms and definitions reference sheet",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Terminology Options",
    optionsSub: "Layout and content settings",
    category: "Assignments",
    options: [
      { type: "select", key: "term-layout", label: "Layout", options: ["Two-column (term | definition)", "Definition box cards", "Alphabetical list", "Category grouped"], defaultValue: "Two-column (term | definition)" },
      { type: "divider" },
      { type: "label", label: "Options" },
      { type: "toggle", key: "term-alpha", label: "Sort alphabetically", defaultValue: true },
      { type: "toggle", key: "term-example", label: "Include example sentence", defaultValue: true },
      { type: "toggle", key: "term-pronun", label: "Include pronunciation", defaultValue: false },
      { type: "toggle", key: "term-etym", label: "Include etymology", defaultValue: false },
      { type: "divider" },
      { type: "slider", key: "term-count", label: "Number of terms", min: 5, max: 60, step: 1, defaultValue: 20 },
    ],
    systemPrompt: (opts) => `You are an expert curriculum developer creating a terminology reference sheet for adult learners.
Generate ${opts["term-count"] || 20} terms.
Return ONLY valid JSON:
{
  "title": "string",
  "terms": [{ "term": "string", "definition": "string", "example": "string or null", "pronunciation": "string or null", "etymology": "string or null", "category": "string" }]
}`,
  },

  custom: {
    label: "Custom Assignment",
    sub: "Freeform - you define the structure",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Custom Options",
    optionsSub: "Define your own structure",
    category: "Assignments",
    options: [
      { type: "textarea", key: "custom-instructions", label: "Instructions to Claude", placeholder: "Describe exactly what you want - sections, format, length, tone, special requirements..." },
      { type: "divider" },
      { type: "select", key: "custom-format", label: "Output format", options: ["Structured document with sections", "Narrative / prose", "Table / grid format", "Checklist / form"], defaultValue: "Structured document with sections" },
    ],
    systemPrompt: (opts) => `You are an expert curriculum developer. Create a custom educational document for adult learners.
Special instructions from the teacher: ${opts["custom-instructions"] || "Create a well-structured educational document."}
Return ONLY valid JSON:
{
  "title": "string",
  "sections": [{ "heading": "string", "content": "string" }]
}`,
  },

  test: {
    label: "Test / Quiz Builder",
    sub: "Formal assessments with scoring",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Test Options",
    optionsSub: "Assessment structure",
    category: "Tests",
    options: [
      { type: "label", label: "Question mix" },
      { type: "toggle", key: "test-mc", label: "Multiple choice", defaultValue: true },
      { type: "toggle", key: "test-tf", label: "True / False", defaultValue: true },
      { type: "toggle", key: "test-sa", label: "Short answer", defaultValue: true },
      { type: "toggle", key: "test-essay", label: "Essay question", defaultValue: false },
      { type: "toggle", key: "test-match", label: "Matching section", defaultValue: false },
      { type: "divider" },
      { type: "slider", key: "test-count", label: "Total questions", min: 5, max: 100, step: 1, defaultValue: 25 },
      { type: "slider", key: "test-points", label: "Total points", min: 25, max: 200, step: 5, defaultValue: 100 },
      { type: "divider" },
      { type: "label", label: "Output" },
      { type: "toggle", key: "test-key", label: "Answer key (separate page)", defaultValue: true },
      { type: "toggle", key: "test-rubric", label: "Rubric for essay/SA", defaultValue: true },
      { type: "toggle", key: "test-wordbank", label: "Word bank", defaultValue: false },
    ],
    systemPrompt: (opts) => `You are an expert assessment developer creating a formal test for adult learners.
Generate ${opts["test-count"] || 25} questions totaling ${opts["test-points"] || 100} points.
Return ONLY valid JSON:
{
  "title": "string",
  "instructions": "string",
  "sections": [{ "name": "string", "instructions": "string", "questions": [{ "number": 1, "type": "mc|tf|sa|essay|match", "question": "string", "options": ["A) ..."] or null, "points": number, "answer": "string" }] }],
  "totalPoints": number,
  "rubric": [{"criteria": "string", "points": number, "description": "string"}] or null
}`,
  },

  lessonplan: {
    label: "Lesson Plan Builder",
    sub: "Complete structured lesson with objectives",
    badge: "DOCX",
    badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700",
    formats: ".docx",
    optionsTitle: "Lesson Plan Options",
    optionsSub: "Structure and format",
    category: "Lessons",
    options: [
      { type: "select", key: "lp-duration", label: "Duration", options: ["30 minutes", "45 minutes", "60 minutes", "90 minutes", "2 hours", "Half day", "Full day"], defaultValue: "60 minutes" },
      { type: "divider" },
      { type: "select", key: "lp-obj", label: "Objectives format", options: ["Bloom's Taxonomy aligned", "SMART goals format", "Simple bullet list"], defaultValue: "Bloom's Taxonomy aligned" },
      { type: "divider" },
      { type: "label", label: "Sections" },
      { type: "toggle", key: "lp-standards", label: "Standards alignment field", defaultValue: true },
      { type: "toggle", key: "lp-materials", label: "Materials list", defaultValue: true },
      { type: "toggle", key: "lp-diff", label: "Differentiation notes", defaultValue: true },
      { type: "toggle", key: "lp-assess", label: "Assessment plan", defaultValue: true },
      { type: "toggle", key: "lp-hw", label: "Homework / follow-up", defaultValue: false },
    ],
    systemPrompt: (opts) => `You are an expert instructional designer creating a detailed lesson plan for adult education.
Return ONLY valid JSON:
{
  "title": "string",
  "duration": "${opts["lp-duration"] || "60 minutes"}",
  "objectives": ["objective 1", "objective 2"],
  "standards": "string or null",
  "materials": ["item 1"] or null,
  "procedure": [{"phase": "string", "duration": "string", "activity": "string", "teacherActions": "string", "studentActions": "string"}],
  "differentiation": "string or null",
  "assessment": "string or null",
  "homework": "string or null",
  "reflection": "string"
}`,
  },

  ppt: {
    label: "PowerPoint Builder",
    sub: "AI-generated slides with web images",
    badge: "PPTX",
    badgeClass: "bg-purple-900/60 text-purple-300 border border-purple-700",
    formats: ".pptx",
    optionsTitle: "Slide Options",
    optionsSub: "PowerPoint-specific settings",
    category: "Presentation",
    options: [
      { type: "slider", key: "ppt-slides", label: "Slides", min: 4, max: 30, step: 1, defaultValue: 12 },
      { type: "toggle", key: "ppt-title", label: "Title slide", defaultValue: true },
      { type: "toggle", key: "ppt-agenda", label: "Agenda slide", defaultValue: true },
      { type: "toggle", key: "ppt-summary", label: "Summary slide", defaultValue: true },
      { type: "toggle", key: "ppt-notes", label: "Speaker notes", defaultValue: true },
      { type: "divider" },
      { type: "select", key: "ppt-theme", label: "Theme", options: ["Clean & minimal", "Bold & colorful", "Academic / professional", "Dark mode", "Corporate"], defaultValue: "Clean & minimal" },
      { type: "chips", key: "ppt-color", label: "Accent color", items: [{ label: "Blue", value: "Blue" }, { label: "Teal", value: "Teal" }, { label: "Purple", value: "Purple" }, { label: "Red", value: "Red" }, { label: "Green", value: "Green" }], defaultValue: "Blue" },
      { type: "divider" },
      { type: "label", label: "Images & Icons" },
      { type: "toggle", key: "ppt-images", label: "Include web images", defaultValue: true },
      { type: "toggle", key: "ppt-icons", label: "Include icons", defaultValue: true },
      { type: "divider" },
      { type: "select", key: "ppt-bullets", label: "Content style", options: ["Concise bullets (3-5 per slide)", "Full sentences", "Question + answer", "Minimal - visuals first"], defaultValue: "Concise bullets (3-5 per slide)" },
      { type: "toggle", key: "ppt-disc", label: "Discussion questions", defaultValue: false },
      { type: "toggle", key: "ppt-keyterms", label: "Key term highlights", defaultValue: true },
    ],
    systemPrompt: (opts) => `You are an expert presentation designer creating a visually engaging PowerPoint for adult learners.
Theme: ${opts["ppt-theme"] || "Clean & minimal"}, Accent: ${opts["ppt-color"] || "Blue"}
Generate ${opts["ppt-slides"] || 12} slides.
IMPORTANT: Make slides visually rich. Each bullet MUST start with a relevant emoji icon. For content slides, include a "keyTakeaway" one-liner. For agenda slides, include "agendaItems" array of short topic names.
Return ONLY valid JSON:
{
  "title": "string",
  "subtitle": "string",
  "slides": [{ "slideNumber": 1, "type": "title|agenda|content|summary|section-break", "title": "string", "subtitle": "string or null", "bullets": ["emoji bullet 1"] or null, "keyTakeaway": "string or null", "agendaItems": ["topic1"] or null, "imageSearchTerm": "string", "speakerNotes": "string or null" }]
}`,
  },
};
