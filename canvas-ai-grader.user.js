// ==UserScript==
// @name         Canvas AI Grader
// @namespace    https://mytrades.instructure.com/
// @version      1.0.0
// @description  All-in-one AI grading assistant for Canvas LMS. Pulls assignments, grades with Claude AI, and submits feedback.
// @author       AIGrader
// @match        https://mytrades.instructure.com/*
// @match        https://*.instructure.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.anthropic.com
// @connect      *.instructure.com
// @connect      docs.google.com
// @connect      docs.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* =========================================================
     CONSTANTS
  ========================================================= */
  const CANVAS_BASE = window.location.origin;
  const STORAGE_KEYS = {
    CANVAS_TOKEN: "cag_canvas_token",
    CLAUDE_KEY: "cag_claude_key",
    RUBRIC: "cag_rubric",
    DEFAULT_COMMENTS: "cag_default_comments",
    STRICTNESS: "cag_strictness",
    MATCH_MODE: "cag_match_mode",
    LAST_COURSE: "cag_last_course",
    LAST_ASSIGNMENT: "cag_last_assignment",
  };

  /* =========================================================
     STYLES
  ========================================================= */
  GM_addStyle(`
    /* ---------- FAB ---------- */
    #cag-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #1e40af; color: #fff; border: none;
      font-size: 24px; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s, background .15s;
    }
    #cag-fab:hover { background: #1d4ed8; transform: scale(1.08); }

    /* ---------- OVERLAY ---------- */
    #cag-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0,0,0,.45);
      display: none; align-items: center; justify-content: center;
    }
    #cag-overlay.cag-open { display: flex; }

    /* ---------- MAIN PANEL ---------- */
    #cag-panel {
      width: 96vw; max-width: 1400px;
      height: 92vh; max-height: 920px;
      background: #fff; border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,.3);
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827; overflow: hidden;
    }

    /* ---------- HEADER ---------- */
    #cag-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: #1e40af; color: #fff;
      flex-shrink: 0;
    }
    #cag-header h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .cag-header-btn {
      background: rgba(255,255,255,.18); border: none; color: #fff;
      padding: 6px 14px; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 600; margin-left: 8px;
      transition: background .15s;
    }
    .cag-header-btn:hover { background: rgba(255,255,255,.3); }

    /* ---------- BODY ---------- */
    #cag-body {
      display: flex; flex: 1; overflow: hidden;
    }

    /* ---------- SIDEBAR ---------- */
    #cag-sidebar {
      width: 300px; border-right: 1px solid #e5e7eb;
      display: flex; flex-direction: column; flex-shrink: 0;
      background: #f9fafb;
    }
    .cag-sidebar-section { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .cag-sidebar-section label {
      display: block; font-size: 12px; font-weight: 600;
      color: #6b7280; margin-bottom: 4px; text-transform: uppercase;
      letter-spacing: .5px;
    }
    .cag-sidebar-section select,
    .cag-sidebar-section input[type="text"] {
      width: 100%; padding: 7px 10px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 13px; background: #fff;
    }

    /* student list */
    #cag-student-list {
      flex: 1; overflow-y: auto; padding: 4px 0;
    }
    .cag-student-item {
      padding: 10px 16px; cursor: pointer; font-size: 13px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #f3f4f6;
      transition: background .1s;
    }
    .cag-student-item:hover { background: #eff6ff; }
    .cag-student-item.cag-active { background: #dbeafe; font-weight: 600; }
    .cag-student-badge {
      font-size: 11px; padding: 2px 8px; border-radius: 10px;
      font-weight: 600;
    }
    .cag-badge-pending { background: #fef3c7; color: #92400e; }
    .cag-badge-graded { background: #d1fae5; color: #065f46; }
    .cag-badge-confirmed { background: #dbeafe; color: #1e40af; }
    .cag-badge-error { background: #fee2e2; color: #991b1b; }

    /* ---------- CONTENT AREA ---------- */
    #cag-content {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
    }

    /* toolbar */
    #cag-toolbar {
      padding: 10px 20px; border-bottom: 1px solid #e5e7eb;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      background: #fff;
    }
    .cag-btn {
      padding: 7px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background .15s, opacity .15s;
    }
    .cag-btn:disabled { opacity: .45; cursor: not-allowed; }
    .cag-btn-primary { background: #1e40af; color: #fff; }
    .cag-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .cag-btn-success { background: #059669; color: #fff; }
    .cag-btn-success:hover:not(:disabled) { background: #047857; }
    .cag-btn-warning { background: #d97706; color: #fff; }
    .cag-btn-warning:hover:not(:disabled) { background: #b45309; }
    .cag-btn-danger { background: #dc2626; color: #fff; }
    .cag-btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .cag-btn-ghost {
      background: transparent; color: #374151;
      border: 1px solid #d1d5db;
    }
    .cag-btn-ghost:hover:not(:disabled) { background: #f3f4f6; }

    /* split pane */
    #cag-split {
      flex: 1; display: flex; overflow: hidden;
    }
    #cag-submission-pane {
      flex: 1; overflow-y: auto; padding: 20px;
      border-right: 1px solid #e5e7eb; background: #fafafa;
    }
    #cag-grading-pane {
      width: 380px; overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
    }

    /* submission display */
    .cag-submission-text {
      white-space: pre-wrap; font-size: 14px; line-height: 1.7;
      background: #fff; padding: 20px; border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .cag-submission-label {
      font-size: 12px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; letter-spacing: .5px;
      margin-bottom: 6px;
    }

    /* grading card */
    .cag-grade-card {
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 8px; padding: 14px;
    }
    .cag-grade-card h4 {
      margin: 0 0 8px; font-size: 13px; color: #374151;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .cag-grade-input {
      width: 80px; padding: 8px 12px; font-size: 20px;
      font-weight: 700; border: 2px solid #d1d5db;
      border-radius: 8px; text-align: center;
    }
    .cag-grade-input:focus { border-color: #1e40af; outline: none; }

    .cag-comment-box {
      width: 100%; min-height: 100px; padding: 10px;
      border: 1px solid #d1d5db; border-radius: 6px;
      font-size: 13px; line-height: 1.5; resize: vertical;
      font-family: inherit;
    }
    .cag-comment-box:focus { border-color: #1e40af; outline: none; }

    /* progress bar */
    .cag-progress-bar {
      height: 6px; background: #e5e7eb; border-radius: 3px;
      overflow: hidden; margin-top: 4px;
    }
    .cag-progress-fill {
      height: 100%; background: #1e40af; border-radius: 3px;
      transition: width .3s;
    }

    /* ---------- SETTINGS MODAL ---------- */
    #cag-settings-overlay {
      position: fixed; inset: 0; z-index: 100001;
      background: rgba(0,0,0,.5);
      display: none; align-items: center; justify-content: center;
    }
    #cag-settings-overlay.cag-open { display: flex; }
    #cag-settings-panel {
      width: 640px; max-height: 85vh; background: #fff;
      border-radius: 12px; overflow-y: auto;
      box-shadow: 0 12px 40px rgba(0,0,0,.3);
    }
    .cag-settings-header {
      padding: 16px 20px; background: #1e40af; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 1;
    }
    .cag-settings-header h3 { margin: 0; font-size: 16px; }
    .cag-settings-body { padding: 20px; }
    .cag-field { margin-bottom: 18px; }
    .cag-field label {
      display: block; font-size: 13px; font-weight: 600;
      color: #374151; margin-bottom: 5px;
    }
    .cag-field input[type="text"],
    .cag-field input[type="password"],
    .cag-field textarea,
    .cag-field select {
      width: 100%; padding: 9px 12px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 13px; font-family: inherit;
    }
    .cag-field textarea { min-height: 80px; resize: vertical; }
    .cag-field .cag-hint {
      font-size: 11px; color: #9ca3af; margin-top: 3px;
    }

    /* ---------- TOAST ---------- */
    .cag-toast {
      position: fixed; bottom: 90px; right: 24px; z-index: 100002;
      background: #1e293b; color: #fff; padding: 10px 20px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
      animation: cag-fade-in .2s;
    }
    @keyframes cag-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ---------- LOADING SPINNER ---------- */
    .cag-spinner {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff; border-radius: 50%;
      animation: cag-spin .6s linear infinite;
    }
    @keyframes cag-spin { to { transform: rotate(360deg); } }

    /* ---------- MISC ---------- */
    .cag-muted { color: #9ca3af; font-size: 12px; }
    .cag-text-center { text-align: center; }
    .cag-mt-4 { margin-top: 4px; }
    .cag-mt-8 { margin-top: 8px; }
    .cag-mt-12 { margin-top: 12px; }
    .cag-flex { display: flex; }
    .cag-gap-8 { gap: 8px; }
    .cag-flex-1 { flex: 1; }
    .cag-items-center { align-items: center; }
    .cag-justify-between { justify-content: space-between; }
  `);

  /* =========================================================
     STORAGE HELPERS
  ========================================================= */
  function store(key, val) {
    GM_setValue(key, JSON.stringify(val));
  }
  function load(key, fallback) {
    try {
      const raw = GM_getValue(key, null);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  /* =========================================================
     TOAST
  ========================================================= */
  function toast(msg, duration) {
    duration = duration || 3000;
    const el = document.createElement("div");
    el.className = "cag-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, duration);
  }

  /* =========================================================
     CANVAS API HELPERS
  ========================================================= */
  function canvasAPI(path, options) {
    options = options || {};
    var token = load(STORAGE_KEYS.CANVAS_TOKEN, "");
    var method = options.method || "GET";
    var body = options.body || null;

    return new Promise(function (resolve, reject) {
      var url = path.startsWith("http") ? path : CANVAS_BASE + "/api/v1" + path;
      GM_xmlhttpRequest({
        method: method,
        url: url,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        data: body ? JSON.stringify(body) : null,
        onload: function (res) {
          try {
            var data = JSON.parse(res.responseText);
            // Handle pagination
            var linkHeader = res.responseHeaders.match(/Link:(.+)/i);
            resolve({ data: data, linkHeader: linkHeader ? linkHeader[1] : null, status: res.status });
          } catch (e) {
            reject(new Error("Canvas API parse error: " + e.message));
          }
        },
        onerror: function (err) {
          reject(new Error("Canvas API request failed"));
        },
      });
    });
  }

  // Fetch all pages from paginated Canvas endpoint
  async function canvasAPIAll(path) {
    var results = [];
    var url = path.startsWith("http") ? path : CANVAS_BASE + "/api/v1" + path;
    var separator = url.includes("?") ? "&" : "?";
    url += separator + "per_page=100";

    while (url) {
      var res = await canvasAPI(url);
      if (Array.isArray(res.data)) {
        results = results.concat(res.data);
      }
      // Parse next page from Link header
      url = null;
      if (res.linkHeader) {
        var nextMatch = res.linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) url = nextMatch[1];
      }
    }
    return results;
  }

  /* =========================================================
     FILE PARSING HELPERS
  ========================================================= */

  // Load external library via script tag and return a promise
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + url + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Fetch file as ArrayBuffer via GM_xmlhttpRequest (bypasses CORS)
  function fetchFileBuffer(url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        responseType: "arraybuffer",
        headers: {
          Authorization: "Bearer " + load(STORAGE_KEYS.CANVAS_TOKEN, ""),
        },
        onload: function (res) {
          resolve(res.response);
        },
        onerror: function () {
          reject(new Error("Failed to fetch file"));
        },
      });
    });
  }

  // Fetch file as text
  function fetchFileText(url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        headers: {
          Authorization: "Bearer " + load(STORAGE_KEYS.CANVAS_TOKEN, ""),
        },
        onload: function (res) {
          resolve(res.responseText);
        },
        onerror: function () {
          reject(new Error("Failed to fetch file"));
        },
      });
    });
  }

  // Parse DOCX to text using mammoth
  async function parseDocx(buffer) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    var result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // Parse XLSX to text using SheetJS
  async function parseXlsx(buffer) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    var workbook = XLSX.read(buffer, { type: "array" });
    var text = "";
    workbook.SheetNames.forEach(function (name) {
      text += "--- Sheet: " + name + " ---\n";
      var sheet = workbook.Sheets[name];
      text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
    });
    return text;
  }

  // Parse PDF to text using pdf.js
  async function parsePdf(buffer) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    var text = "";
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      text += content.items.map(function (item) { return item.str; }).join(" ") + "\n";
    }
    return text;
  }

  // Try to extract text from Google Docs/Sheets/Slides URL
  async function parseGoogleLink(url) {
    try {
      // Extract document ID
      var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) return "[Could not parse Google Doc link: " + url + "]";

      var docId = match[1];
      var exportUrl;
      if (url.includes("docs.google.com/document")) {
        exportUrl = "https://docs.google.com/document/d/" + docId + "/export?format=txt";
      } else if (url.includes("docs.google.com/spreadsheets")) {
        exportUrl = "https://docs.google.com/spreadsheets/d/" + docId + "/export?format=csv";
      } else if (url.includes("docs.google.com/presentation")) {
        exportUrl = "https://docs.google.com/presentation/d/" + docId + "/export?format=txt";
      } else {
        return "[Unsupported Google link type: " + url + "]";
      }

      var text = await fetchFileText(exportUrl);
      return text || "[Empty Google document]";
    } catch (e) {
      return "[Failed to fetch Google Doc: " + e.message + "]";
    }
  }

  // Master file parser: given a URL and filename, extract text
  async function extractSubmissionText(submission) {
    var texts = [];

    // 1. Online text submission
    if (submission.body) {
      // Strip HTML tags from the body
      var div = document.createElement("div");
      div.innerHTML = submission.body;
      texts.push(div.textContent || div.innerText || "");
    }

    // 2. URL submission
    if (submission.url) {
      if (submission.url.match(/docs\.google\.com/)) {
        var gText = await parseGoogleLink(submission.url);
        texts.push(gText);
      } else {
        texts.push("[Submitted URL: " + submission.url + "]");
      }
    }

    // 3. File attachments
    if (submission.attachments && submission.attachments.length > 0) {
      for (var i = 0; i < submission.attachments.length; i++) {
        var att = submission.attachments[i];
        var filename = (att.filename || att.display_name || "").toLowerCase();
        var fileUrl = att.url;

        try {
          if (filename.endsWith(".txt") || filename.endsWith(".md") || filename.endsWith(".csv")) {
            var t = await fetchFileText(fileUrl);
            texts.push("--- File: " + att.filename + " ---\n" + t);
          } else if (filename.endsWith(".docx")) {
            var buf = await fetchFileBuffer(fileUrl);
            var docxText = await parseDocx(buf);
            texts.push("--- File: " + att.filename + " ---\n" + docxText);
          } else if (filename.endsWith(".doc")) {
            texts.push("--- File: " + att.filename + " ---\n[.doc format not supported - only .docx can be parsed]");
          } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            var xlsBuf = await fetchFileBuffer(fileUrl);
            var xlsText = await parseXlsx(xlsBuf);
            texts.push("--- File: " + att.filename + " ---\n" + xlsText);
          } else if (filename.endsWith(".pdf")) {
            var pdfBuf = await fetchFileBuffer(fileUrl);
            var pdfText = await parsePdf(pdfBuf);
            texts.push("--- File: " + att.filename + " ---\n" + pdfText);
          } else {
            texts.push("--- File: " + att.filename + " ---\n[Unsupported file type]");
          }
        } catch (e) {
          texts.push("--- File: " + att.filename + " ---\n[Error reading file: " + e.message + "]");
        }
      }
    }

    // 4. If nothing found
    if (texts.length === 0) {
      if (submission.submission_type === "online_text_entry" && !submission.body) {
        texts.push("[No text submitted]");
      } else if (submission.submission_type === "online_url" && !submission.url) {
        texts.push("[No URL submitted]");
      } else if (!submission.submission_type || submission.workflow_state === "unsubmitted") {
        texts.push("[No submission]");
      } else {
        texts.push("[Submission type: " + (submission.submission_type || "unknown") + " - content could not be extracted]");
      }
    }

    return texts.join("\n\n");
  }

  /* =========================================================
     CLAUDE AI GRADING
  ========================================================= */
  async function gradeWithClaude(submissionText, rubric, settings) {
    var apiKey = load(STORAGE_KEYS.CLAUDE_KEY, "");
    if (!apiKey) throw new Error("Claude API key not configured. Open Settings to add it.");

    var strictness = settings.strictness || "moderate";
    var matchMode = settings.matchMode || "general_intent";
    var defaultComments = settings.defaultComments || "";

    var systemPrompt = [
      "You are an expert academic grader. Grade the student submission based on the rubric/answer key provided.",
      "",
      "GRADING PARAMETERS:",
      "- Strictness level: " + strictness.toUpperCase(),
      strictness === "lenient"
        ? "  (Be generous with partial credit. Give benefit of the doubt. Focus on what the student got right.)"
        : strictness === "strict"
        ? "  (Be rigorous. Require precise answers. Deduct for any inaccuracies or missing details.)"
        : "  (Apply standard academic grading. Give partial credit where reasonable.)",
      "",
      "- Matching mode: " + matchMode.replace("_", " ").toUpperCase(),
      matchMode === "exact_match"
        ? "  (Answers must closely match the expected answer. Minor wording differences OK, but meaning must be precise.)"
        : "  (Accept answers that demonstrate understanding of the concept, even if worded differently from the key.)",
      "",
      defaultComments
        ? "DEFAULT COMMENT BANK (use these phrases when applicable):\n" + defaultComments
        : "",
      "",
      "RUBRIC / ANSWER KEY:",
      rubric || "[No rubric provided - grade based on general quality, completeness, and accuracy]",
      "",
      "INSTRUCTIONS:",
      "1. Read the submission carefully.",
      "2. Compare against the rubric/answer key.",
      "3. Assign a numerical grade (0-100 unless the rubric specifies a different scale).",
      "4. Write specific, constructive comments addressing what the student did well and where they can improve.",
      "5. Address the student directly using second person (\"you\").",
      "",
      "RESPOND IN THIS EXACT JSON FORMAT:",
      '{',
      '  "grade": <number>,',
      '  "maxGrade": <number>,',
      '  "comments": "<detailed feedback as a single string>",',
      '  "breakdown": [',
      '    { "criterion": "<rubric item>", "score": <number>, "maxScore": <number>, "feedback": "<specific feedback>" }',
      '  ]',
      '}',
      "",
      "Return ONLY valid JSON. No markdown, no explanation outside JSON.",
    ].join("\n");

    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        data: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: systemPrompt + "\n\nSTUDENT SUBMISSION:\n" + submissionText,
            },
          ],
        }),
        onload: function (res) {
          try {
            var data = JSON.parse(res.responseText);
            if (data.error) {
              reject(new Error("Claude API error: " + (data.error.message || JSON.stringify(data.error))));
              return;
            }
            var text = data.content && data.content[0] && data.content[0].text;
            if (!text) {
              reject(new Error("Empty response from Claude"));
              return;
            }
            // Extract JSON from response (handle potential markdown wrapping)
            var jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              reject(new Error("Could not parse Claude response as JSON"));
              return;
            }
            var parsed = JSON.parse(jsonMatch[0]);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Failed to parse Claude response: " + e.message));
          }
        },
        onerror: function () {
          reject(new Error("Claude API request failed"));
        },
      });
    });
  }

  /* =========================================================
     APP STATE
  ========================================================= */
  var state = {
    courses: [],
    assignments: [],
    submissions: [], // { submission, studentName, extractedText, gradeResult, status }
    selectedCourseId: null,
    selectedAssignmentId: null,
    currentIndex: -1,
    isGradingAll: false,
    isFetching: false,
  };

  /* =========================================================
     UI RENDERING
  ========================================================= */

  function createFAB() {
    var fab = document.createElement("button");
    fab.id = "cag-fab";
    fab.innerHTML = "&#x1F4DD;"; // memo emoji
    fab.title = "AI Grader";
    fab.addEventListener("click", function () {
      openMainPanel();
    });
    document.body.appendChild(fab);
  }

  function openMainPanel() {
    var overlay = document.getElementById("cag-overlay");
    if (!overlay) {
      overlay = buildMainPanel();
    }
    overlay.classList.add("cag-open");
    loadCourses();
  }

  function closeMainPanel() {
    var overlay = document.getElementById("cag-overlay");
    if (overlay) overlay.classList.remove("cag-open");
  }

  function buildMainPanel() {
    var overlay = document.createElement("div");
    overlay.id = "cag-overlay";

    overlay.innerHTML = [
      '<div id="cag-panel">',
      // Header
      '  <div id="cag-header">',
      '    <h2>Canvas AI Grader</h2>',
      '    <div>',
      '      <button class="cag-header-btn" id="cag-btn-settings">Settings</button>',
      '      <button class="cag-header-btn" id="cag-btn-close">Close</button>',
      '    </div>',
      '  </div>',
      // Body
      '  <div id="cag-body">',
      // Sidebar
      '    <div id="cag-sidebar">',
      '      <div class="cag-sidebar-section">',
      '        <label>Course</label>',
      '        <select id="cag-course-select"><option value="">Loading...</option></select>',
      '      </div>',
      '      <div class="cag-sidebar-section">',
      '        <label>Assignment</label>',
      '        <select id="cag-assignment-select"><option value="">Select a course first</option></select>',
      '      </div>',
      '      <div class="cag-sidebar-section cag-flex cag-gap-8">',
      '        <button class="cag-btn cag-btn-primary cag-flex-1" id="cag-btn-fetch">Fetch Submissions</button>',
      '      </div>',
      '      <div class="cag-sidebar-section" id="cag-progress-section" style="display:none;">',
      '        <div class="cag-flex cag-justify-between cag-items-center">',
      '          <span class="cag-muted" id="cag-progress-text">0 / 0</span>',
      '          <span class="cag-muted" id="cag-status-counts"></span>',
      '        </div>',
      '        <div class="cag-progress-bar cag-mt-4"><div class="cag-progress-fill" id="cag-progress-fill"></div></div>',
      '      </div>',
      '      <div id="cag-student-list"></div>',
      '    </div>',
      // Content
      '    <div id="cag-content">',
      '      <div id="cag-toolbar">',
      '        <button class="cag-btn cag-btn-primary" id="cag-btn-grade-current" disabled>Grade This</button>',
      '        <button class="cag-btn cag-btn-warning" id="cag-btn-grade-all" disabled>Grade All</button>',
      '        <div class="cag-flex-1"></div>',
      '        <button class="cag-btn cag-btn-ghost" id="cag-btn-prev" disabled>&larr; Prev</button>',
      '        <button class="cag-btn cag-btn-ghost" id="cag-btn-next" disabled>Next &rarr;</button>',
      '        <div class="cag-flex-1"></div>',
      '        <button class="cag-btn cag-btn-success" id="cag-btn-confirm" disabled>Confirm</button>',
      '        <button class="cag-btn cag-btn-success" id="cag-btn-confirm-all" disabled>Confirm All</button>',
      '        <button class="cag-btn cag-btn-danger" id="cag-btn-submit" disabled>Submit to Canvas</button>',
      '      </div>',
      '      <div id="cag-split">',
      '        <div id="cag-submission-pane">',
      '          <div class="cag-text-center cag-muted" style="margin-top:40px;">',
      '            Select a course and assignment, then click &ldquo;Fetch Submissions&rdquo; to begin.',
      '          </div>',
      '        </div>',
      '        <div id="cag-grading-pane">',
      '          <div class="cag-text-center cag-muted" style="margin-top:40px;">',
      '            Grade suggestions will appear here.',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("\n");

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById("cag-btn-close").addEventListener("click", closeMainPanel);
    document.getElementById("cag-btn-settings").addEventListener("click", openSettings);
    document.getElementById("cag-course-select").addEventListener("change", onCourseChange);
    document.getElementById("cag-assignment-select").addEventListener("change", onAssignmentChange);
    document.getElementById("cag-btn-fetch").addEventListener("click", fetchSubmissions);
    document.getElementById("cag-btn-grade-current").addEventListener("click", gradeCurrentSubmission);
    document.getElementById("cag-btn-grade-all").addEventListener("click", gradeAllSubmissions);
    document.getElementById("cag-btn-prev").addEventListener("click", function () { navigateSubmission(-1); });
    document.getElementById("cag-btn-next").addEventListener("click", function () { navigateSubmission(1); });
    document.getElementById("cag-btn-confirm").addEventListener("click", confirmCurrent);
    document.getElementById("cag-btn-confirm-all").addEventListener("click", confirmAllGraded);
    document.getElementById("cag-btn-submit").addEventListener("click", submitToCanvas);

    // Close on backdrop click
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeMainPanel();
    });

    return overlay;
  }

  /* =========================================================
     SETTINGS MODAL
  ========================================================= */
  function openSettings() {
    var existing = document.getElementById("cag-settings-overlay");
    if (existing) existing.remove();

    var settingsOverlay = document.createElement("div");
    settingsOverlay.id = "cag-settings-overlay";
    settingsOverlay.className = "cag-open";

    settingsOverlay.innerHTML = [
      '<div id="cag-settings-panel">',
      '  <div class="cag-settings-header">',
      '    <h3>AI Grader Settings</h3>',
      '    <button class="cag-header-btn" id="cag-settings-close">Close</button>',
      '  </div>',
      '  <div class="cag-settings-body">',
      '    <div class="cag-field">',
      '      <label>Canvas API Token</label>',
      '      <input type="password" id="cag-set-canvas-token" placeholder="Enter your Canvas API token">',
      '      <div class="cag-hint">Generate from Canvas: Account &gt; Settings &gt; New Access Token</div>',
      '    </div>',
      '    <div class="cag-field">',
      '      <label>Claude API Key</label>',
      '      <input type="password" id="cag-set-claude-key" placeholder="Enter your Anthropic API key">',
      '      <div class="cag-hint">Get from console.anthropic.com/settings/keys</div>',
      '    </div>',
      '    <hr style="margin:20px 0; border:0; border-top:1px solid #e5e7eb;">',
      '    <div class="cag-field">',
      '      <label>Rubric / Answer Key</label>',
      '      <textarea id="cag-set-rubric" placeholder="Paste your rubric, answer key, or grading criteria here.\n\nExample:\nQ1 (10 pts): Define photosynthesis.\nExpected: Process by which plants convert light energy to chemical energy using CO2 and water.\n\nQ2 (15 pts): Explain the light reactions.\nExpected: Takes place in thylakoid membranes..."></textarea>',
      '      <div class="cag-hint">This will be sent to Claude as the grading criteria. You can use any format.</div>',
      '    </div>',
      '    <div class="cag-field">',
      '      <label>Default Comment Bank</label>',
      '      <textarea id="cag-set-comments" placeholder="Enter default comments/phrases the AI should use when applicable.\n\nExample:\n- Great work on this section!\n- Please review the chapter on...\n- Missing key details about...\n- Excellent analysis!"></textarea>',
      '      <div class="cag-hint">Common feedback phrases the AI can draw from when commenting.</div>',
      '    </div>',
      '    <div class="cag-field">',
      '      <label>Grade Strictness</label>',
      '      <select id="cag-set-strictness">',
      '        <option value="lenient">Lenient - Generous with partial credit</option>',
      '        <option value="moderate" selected>Moderate - Standard academic grading</option>',
      '        <option value="strict">Strict - Rigorous, precise answers required</option>',
      '      </select>',
      '    </div>',
      '    <div class="cag-field">',
      '      <label>Answer Matching Mode</label>',
      '      <select id="cag-set-match-mode">',
      '        <option value="general_intent" selected>General Intent - Accept conceptually correct answers</option>',
      '        <option value="exact_match">Exact Match - Require precise, specific answers</option>',
      '      </select>',
      '    </div>',
      '    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">',
      '      <button class="cag-btn cag-btn-ghost" id="cag-settings-cancel">Cancel</button>',
      '      <button class="cag-btn cag-btn-primary" id="cag-settings-save">Save Settings</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("\n");

    document.body.appendChild(settingsOverlay);

    // Load saved values
    document.getElementById("cag-set-canvas-token").value = load(STORAGE_KEYS.CANVAS_TOKEN, "");
    document.getElementById("cag-set-claude-key").value = load(STORAGE_KEYS.CLAUDE_KEY, "");
    document.getElementById("cag-set-rubric").value = load(STORAGE_KEYS.RUBRIC, "");
    document.getElementById("cag-set-comments").value = load(STORAGE_KEYS.DEFAULT_COMMENTS, "");
    document.getElementById("cag-set-strictness").value = load(STORAGE_KEYS.STRICTNESS, "moderate");
    document.getElementById("cag-set-match-mode").value = load(STORAGE_KEYS.MATCH_MODE, "general_intent");

    // Events
    document.getElementById("cag-settings-close").addEventListener("click", closeSettings);
    document.getElementById("cag-settings-cancel").addEventListener("click", closeSettings);
    document.getElementById("cag-settings-save").addEventListener("click", saveSettings);
    settingsOverlay.addEventListener("click", function (e) {
      if (e.target === settingsOverlay) closeSettings();
    });
  }

  function closeSettings() {
    var el = document.getElementById("cag-settings-overlay");
    if (el) el.remove();
  }

  function saveSettings() {
    store(STORAGE_KEYS.CANVAS_TOKEN, document.getElementById("cag-set-canvas-token").value.trim());
    store(STORAGE_KEYS.CLAUDE_KEY, document.getElementById("cag-set-claude-key").value.trim());
    store(STORAGE_KEYS.RUBRIC, document.getElementById("cag-set-rubric").value);
    store(STORAGE_KEYS.DEFAULT_COMMENTS, document.getElementById("cag-set-comments").value);
    store(STORAGE_KEYS.STRICTNESS, document.getElementById("cag-set-strictness").value);
    store(STORAGE_KEYS.MATCH_MODE, document.getElementById("cag-set-match-mode").value);
    toast("Settings saved!");
    closeSettings();
  }

  /* =========================================================
     COURSE / ASSIGNMENT LOADING
  ========================================================= */
  async function loadCourses() {
    var select = document.getElementById("cag-course-select");
    select.innerHTML = '<option value="">Loading courses...</option>';

    try {
      var courses = await canvasAPIAll("/courses?enrollment_type=teacher&state[]=available");
      state.courses = courses;

      select.innerHTML = '<option value="">-- Select a Course --</option>';
      courses.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || c.course_code || ("Course " + c.id);
        select.appendChild(opt);
      });

      // Restore last selection
      var lastCourse = load(STORAGE_KEYS.LAST_COURSE, "");
      if (lastCourse) {
        select.value = lastCourse;
        if (select.value === lastCourse) onCourseChange();
      }
    } catch (e) {
      select.innerHTML = '<option value="">Error loading courses</option>';
      toast("Failed to load courses. Check your Canvas API token in Settings.");
    }
  }

  async function onCourseChange() {
    var courseId = document.getElementById("cag-course-select").value;
    state.selectedCourseId = courseId;
    store(STORAGE_KEYS.LAST_COURSE, courseId);

    var assignSelect = document.getElementById("cag-assignment-select");

    if (!courseId) {
      assignSelect.innerHTML = '<option value="">Select a course first</option>';
      state.assignments = [];
      return;
    }

    assignSelect.innerHTML = '<option value="">Loading assignments...</option>';

    try {
      var assignments = await canvasAPIAll("/courses/" + courseId + "/assignments?order_by=due_at");
      state.assignments = assignments;

      assignSelect.innerHTML = '<option value="">-- Select an Assignment --</option>';
      assignments.forEach(function (a) {
        var opt = document.createElement("option");
        opt.value = a.id;
        var dueDate = a.due_at ? " (Due: " + new Date(a.due_at).toLocaleDateString() + ")" : "";
        opt.textContent = (a.name || "Assignment " + a.id) + dueDate;
        assignSelect.appendChild(opt);
      });

      var lastAssign = load(STORAGE_KEYS.LAST_ASSIGNMENT, "");
      if (lastAssign) {
        assignSelect.value = lastAssign;
      }
    } catch (e) {
      assignSelect.innerHTML = '<option value="">Error loading assignments</option>';
    }
  }

  function onAssignmentChange() {
    var val = document.getElementById("cag-assignment-select").value;
    state.selectedAssignmentId = val;
    store(STORAGE_KEYS.LAST_ASSIGNMENT, val);
  }

  /* =========================================================
     FETCH SUBMISSIONS
  ========================================================= */
  async function fetchSubmissions() {
    var courseId = state.selectedCourseId;
    var assignmentId = state.selectedAssignmentId || document.getElementById("cag-assignment-select").value;

    if (!courseId || !assignmentId) {
      toast("Select a course and assignment first.");
      return;
    }

    state.selectedAssignmentId = assignmentId;
    state.isFetching = true;
    state.submissions = [];
    state.currentIndex = -1;
    updateStudentList();
    updateToolbar();

    var fetchBtn = document.getElementById("cag-btn-fetch");
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<span class="cag-spinner"></span> Fetching...';

    try {
      var submissions = await canvasAPIAll(
        "/courses/" + courseId + "/assignments/" + assignmentId + "/submissions?include[]=user&include[]=submission_comments"
      );

      // Filter out test student and unsubmitted
      var filtered = submissions.filter(function (s) {
        return s.user && !s.user.name.match(/test student/i);
      });

      toast("Extracting submission content for " + filtered.length + " students...");

      // Extract text from each submission
      for (var i = 0; i < filtered.length; i++) {
        var sub = filtered[i];
        var text = "";
        try {
          text = await extractSubmissionText(sub);
        } catch (e) {
          text = "[Error extracting submission: " + e.message + "]";
        }

        state.submissions.push({
          submission: sub,
          studentName: sub.user ? sub.user.name : "Unknown",
          extractedText: text,
          gradeResult: null,
          status: (sub.workflow_state === "unsubmitted" || !sub.submission_type) ? "unsubmitted" : "pending",
        });
      }

      document.getElementById("cag-progress-section").style.display = "block";
      updateStudentList();
      updateProgress();

      if (state.submissions.length > 0) {
        state.currentIndex = 0;
        renderCurrentSubmission();
      }

      toast("Loaded " + state.submissions.length + " submissions!");
    } catch (e) {
      toast("Error fetching submissions: " + e.message);
    }

    fetchBtn.disabled = false;
    fetchBtn.innerHTML = "Fetch Submissions";
    state.isFetching = false;
    updateToolbar();
  }

  /* =========================================================
     STUDENT LIST
  ========================================================= */
  function updateStudentList() {
    var list = document.getElementById("cag-student-list");
    if (!list) return;

    list.innerHTML = "";
    state.submissions.forEach(function (item, idx) {
      var div = document.createElement("div");
      div.className = "cag-student-item" + (idx === state.currentIndex ? " cag-active" : "");

      var badgeClass = "cag-badge-pending";
      var badgeText = "Pending";
      if (item.status === "graded") { badgeClass = "cag-badge-graded"; badgeText = "Graded"; }
      else if (item.status === "confirmed") { badgeClass = "cag-badge-confirmed"; badgeText = "Confirmed"; }
      else if (item.status === "error") { badgeClass = "cag-badge-error"; badgeText = "Error"; }
      else if (item.status === "unsubmitted") { badgeClass = "cag-badge-error"; badgeText = "No Sub"; }

      div.innerHTML =
        '<span>' + escapeHTML(item.studentName) + '</span>' +
        '<span class="cag-student-badge ' + badgeClass + '">' + badgeText + '</span>';

      div.addEventListener("click", function () {
        state.currentIndex = idx;
        renderCurrentSubmission();
        updateStudentList();
        updateToolbar();
      });

      list.appendChild(div);
    });
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     RENDER CURRENT SUBMISSION
  ========================================================= */
  function renderCurrentSubmission() {
    var subPane = document.getElementById("cag-submission-pane");
    var gradePane = document.getElementById("cag-grading-pane");

    if (state.currentIndex < 0 || state.currentIndex >= state.submissions.length) {
      subPane.innerHTML = '<div class="cag-text-center cag-muted" style="margin-top:40px;">No submission selected.</div>';
      gradePane.innerHTML = '<div class="cag-text-center cag-muted" style="margin-top:40px;">Grade suggestions will appear here.</div>';
      updateToolbar();
      return;
    }

    var item = state.submissions[state.currentIndex];

    // Submission pane
    subPane.innerHTML = [
      '<div class="cag-submission-label">Student: ' + escapeHTML(item.studentName) + '</div>',
      '<div class="cag-submission-label cag-mt-8">Submission Type: ' + escapeHTML(item.submission.submission_type || "none") + '</div>',
      '<div class="cag-submission-text cag-mt-8">' + escapeHTML(item.extractedText || "[No content]") + '</div>',
    ].join("");

    // Grading pane
    if (item.gradeResult) {
      renderGradeResult(item);
    } else if (item.status === "unsubmitted") {
      gradePane.innerHTML = '<div class="cag-text-center cag-muted" style="margin-top:40px;">No submission to grade.</div>';
    } else {
      gradePane.innerHTML = '<div class="cag-text-center cag-muted" style="margin-top:40px;">Click "Grade This" or "Grade All" to get AI suggestions.</div>';
    }

    updateToolbar();
  }

  function renderGradeResult(item) {
    var gradePane = document.getElementById("cag-grading-pane");
    var result = item.gradeResult;

    var breakdownHTML = "";
    if (result.breakdown && result.breakdown.length > 0) {
      breakdownHTML = '<div class="cag-grade-card"><h4>Breakdown</h4>';
      result.breakdown.forEach(function (b) {
        breakdownHTML += [
          '<div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f3f4f6;">',
          '  <div class="cag-flex cag-justify-between cag-items-center">',
          '    <strong style="font-size:12px;">' + escapeHTML(b.criterion || "") + '</strong>',
          '    <span style="font-size:13px; font-weight:700;">' + (b.score != null ? b.score : "?") + ' / ' + (b.maxScore != null ? b.maxScore : "?") + '</span>',
          '  </div>',
          '  <div style="font-size:12px; color:#6b7280; margin-top:4px;">' + escapeHTML(b.feedback || "") + '</div>',
          '</div>',
        ].join("");
      });
      breakdownHTML += "</div>";
    }

    gradePane.innerHTML = [
      '<div class="cag-grade-card">',
      '  <h4>Suggested Grade</h4>',
      '  <div class="cag-flex cag-items-center cag-gap-8">',
      '    <input type="number" class="cag-grade-input" id="cag-grade-val" value="' + (result.grade != null ? result.grade : "") + '">',
      '    <span style="font-size:16px; color:#6b7280;"> / ' + (result.maxGrade || 100) + '</span>',
      '  </div>',
      '</div>',
      breakdownHTML,
      '<div class="cag-grade-card">',
      '  <h4>Comments / Feedback</h4>',
      '  <textarea class="cag-comment-box" id="cag-comment-val">' + escapeHTML(result.comments || "") + '</textarea>',
      '</div>',
    ].join("");

    // Sync edits back to state
    document.getElementById("cag-grade-val").addEventListener("input", function () {
      item.gradeResult.grade = parseFloat(this.value) || 0;
    });
    document.getElementById("cag-comment-val").addEventListener("input", function () {
      item.gradeResult.comments = this.value;
    });
  }

  /* =========================================================
     TOOLBAR STATE
  ========================================================= */
  function updateToolbar() {
    var hasSubs = state.submissions.length > 0;
    var hasSelection = state.currentIndex >= 0;
    var currentItem = hasSelection ? state.submissions[state.currentIndex] : null;
    var gradedCount = state.submissions.filter(function (s) { return s.status === "graded" || s.status === "confirmed"; }).length;
    var confirmedCount = state.submissions.filter(function (s) { return s.status === "confirmed"; }).length;

    document.getElementById("cag-btn-grade-current").disabled = !hasSelection || !currentItem || currentItem.status === "unsubmitted";
    document.getElementById("cag-btn-grade-all").disabled = !hasSubs || state.isGradingAll;
    document.getElementById("cag-btn-prev").disabled = !hasSelection || state.currentIndex <= 0;
    document.getElementById("cag-btn-next").disabled = !hasSelection || state.currentIndex >= state.submissions.length - 1;
    document.getElementById("cag-btn-confirm").disabled = !currentItem || (currentItem.status !== "graded");
    document.getElementById("cag-btn-confirm-all").disabled = gradedCount === 0;
    document.getElementById("cag-btn-submit").disabled = confirmedCount === 0;
  }

  function updateProgress() {
    var total = state.submissions.length;
    var graded = state.submissions.filter(function (s) { return s.status === "graded" || s.status === "confirmed"; }).length;
    var confirmed = state.submissions.filter(function (s) { return s.status === "confirmed"; }).length;

    document.getElementById("cag-progress-text").textContent = graded + " / " + total + " graded";
    document.getElementById("cag-status-counts").textContent = confirmed + " confirmed";
    document.getElementById("cag-progress-fill").style.width = (total > 0 ? (graded / total * 100) : 0) + "%";
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */
  function navigateSubmission(delta) {
    var newIdx = state.currentIndex + delta;
    if (newIdx < 0 || newIdx >= state.submissions.length) return;
    state.currentIndex = newIdx;
    renderCurrentSubmission();
    updateStudentList();
    updateToolbar();
  }

  /* =========================================================
     GRADING ACTIONS
  ========================================================= */
  async function gradeCurrentSubmission() {
    if (state.currentIndex < 0) return;
    var item = state.submissions[state.currentIndex];
    if (item.status === "unsubmitted") return;

    var btn = document.getElementById("cag-btn-grade-current");
    btn.disabled = true;
    btn.innerHTML = '<span class="cag-spinner"></span> Grading...';

    try {
      var result = await gradeWithClaude(item.extractedText, load(STORAGE_KEYS.RUBRIC, ""), {
        strictness: load(STORAGE_KEYS.STRICTNESS, "moderate"),
        matchMode: load(STORAGE_KEYS.MATCH_MODE, "general_intent"),
        defaultComments: load(STORAGE_KEYS.DEFAULT_COMMENTS, ""),
      });

      item.gradeResult = result;
      item.status = "graded";
      renderGradeResult(item);
    } catch (e) {
      item.status = "error";
      document.getElementById("cag-grading-pane").innerHTML =
        '<div class="cag-grade-card" style="border-color:#fca5a5;"><h4 style="color:#dc2626;">Grading Error</h4><p style="font-size:13px;">' +
        escapeHTML(e.message) + "</p></div>";
    }

    btn.innerHTML = "Grade This";
    btn.disabled = false;
    updateStudentList();
    updateProgress();
    updateToolbar();
  }

  async function gradeAllSubmissions() {
    state.isGradingAll = true;
    var btn = document.getElementById("cag-btn-grade-all");
    btn.disabled = true;
    btn.innerHTML = '<span class="cag-spinner"></span> Grading All...';

    var settings = {
      strictness: load(STORAGE_KEYS.STRICTNESS, "moderate"),
      matchMode: load(STORAGE_KEYS.MATCH_MODE, "general_intent"),
      defaultComments: load(STORAGE_KEYS.DEFAULT_COMMENTS, ""),
    };
    var rubric = load(STORAGE_KEYS.RUBRIC, "");

    for (var i = 0; i < state.submissions.length; i++) {
      var item = state.submissions[i];
      if (item.status === "unsubmitted" || item.status === "confirmed") continue;

      state.currentIndex = i;
      renderCurrentSubmission();
      updateStudentList();

      try {
        var result = await gradeWithClaude(item.extractedText, rubric, settings);
        item.gradeResult = result;
        item.status = "graded";
        renderGradeResult(item);
      } catch (e) {
        item.status = "error";
        item.gradeResult = { grade: 0, comments: "Grading error: " + e.message, breakdown: [] };
      }

      updateStudentList();
      updateProgress();
      updateToolbar();
    }

    btn.innerHTML = "Grade All";
    state.isGradingAll = false;
    updateToolbar();
    toast("All submissions graded!");
  }

  /* =========================================================
     CONFIRM ACTIONS
  ========================================================= */
  function confirmCurrent() {
    if (state.currentIndex < 0) return;
    var item = state.submissions[state.currentIndex];
    if (item.status !== "graded") return;

    // Sync any edits from the UI
    var gradeInput = document.getElementById("cag-grade-val");
    var commentInput = document.getElementById("cag-comment-val");
    if (gradeInput) item.gradeResult.grade = parseFloat(gradeInput.value) || 0;
    if (commentInput) item.gradeResult.comments = commentInput.value;

    item.status = "confirmed";
    updateStudentList();
    updateProgress();
    updateToolbar();

    // Auto-advance to next unconfirmed
    var nextIdx = state.submissions.findIndex(function (s, idx) {
      return idx > state.currentIndex && (s.status === "graded" || s.status === "pending");
    });
    if (nextIdx >= 0) {
      state.currentIndex = nextIdx;
      renderCurrentSubmission();
      updateStudentList();
      updateToolbar();
    }

    toast("Grade confirmed for " + item.studentName);
  }

  function confirmAllGraded() {
    state.submissions.forEach(function (item) {
      if (item.status === "graded") {
        item.status = "confirmed";
      }
    });
    updateStudentList();
    updateProgress();
    updateToolbar();
    toast("All graded submissions confirmed!");
  }

  /* =========================================================
     SUBMIT TO CANVAS
  ========================================================= */
  async function submitToCanvas() {
    var confirmed = state.submissions.filter(function (s) { return s.status === "confirmed"; });
    if (confirmed.length === 0) {
      toast("No confirmed grades to submit.");
      return;
    }

    var proceed = confirm(
      "Submit " + confirmed.length + " grades to Canvas?\n\nThis will update grades and post comments for all confirmed submissions."
    );
    if (!proceed) return;

    var submitBtn = document.getElementById("cag-btn-submit");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="cag-spinner"></span> Submitting...';

    var successes = 0;
    var failures = 0;

    for (var i = 0; i < confirmed.length; i++) {
      var item = confirmed[i];
      try {
        // Post grade
        await canvasAPI(
          "/courses/" + state.selectedCourseId +
          "/assignments/" + state.selectedAssignmentId +
          "/submissions/" + item.submission.user_id,
          {
            method: "PUT",
            body: {
              submission: {
                posted_grade: String(item.gradeResult.grade),
              },
            },
          }
        );

        // Post comment
        if (item.gradeResult.comments && item.gradeResult.comments.trim()) {
          await canvasAPI(
            "/courses/" + state.selectedCourseId +
            "/assignments/" + state.selectedAssignmentId +
            "/submissions/" + item.submission.user_id,
            {
              method: "PUT",
              body: {
                comment: {
                  text_comment: item.gradeResult.comments,
                },
              },
            }
          );
        }

        item.status = "submitted";
        successes++;
      } catch (e) {
        item.status = "error";
        failures++;
      }

      updateStudentList();
      updateProgress();
    }

    submitBtn.innerHTML = "Submit to Canvas";
    submitBtn.disabled = false;
    updateToolbar();

    var msg = successes + " grades submitted successfully!";
    if (failures > 0) msg += " " + failures + " failed.";
    toast(msg, 5000);
  }

  /* =========================================================
     KEYBOARD SHORTCUTS
  ========================================================= */
  document.addEventListener("keydown", function (e) {
    // Only when panel is open
    var overlay = document.getElementById("cag-overlay");
    if (!overlay || !overlay.classList.contains("cag-open")) return;

    // Don't capture when typing in inputs
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      navigateSubmission(-1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      navigateSubmission(1);
    } else if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      confirmCurrent();
    } else if (e.key === "g" && !e.ctrlKey) {
      e.preventDefault();
      gradeCurrentSubmission();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMainPanel();
    }
  });

  /* =========================================================
     INIT
  ========================================================= */
  function init() {
    // Check if we have API tokens configured
    var hasCanvasToken = !!load(STORAGE_KEYS.CANVAS_TOKEN, "");
    var hasClaudeKey = !!load(STORAGE_KEYS.CLAUDE_KEY, "");

    createFAB();

    // If first time, show settings
    if (!hasCanvasToken || !hasClaudeKey) {
      setTimeout(function () {
        toast("Welcome to Canvas AI Grader! Click the button and configure your API keys in Settings.", 5000);
      }, 1000);
    }
  }

  init();
})();
