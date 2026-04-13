// ==UserScript==
// @name         Classroom AI Assistant
// @namespace    https://classroom.google.com
// @version      2.0.0
// @description  AI-powered content creator and auto-grader for Google Classroom
// @author       You
// @match        https://classroom.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      classroom.googleapis.com
// @connect      accounts.google.com
// @connect      api.anthropic.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIG ─────────────────────────────────────────────────────────────────
  // Paste your OAuth 2.0 Client ID here (Web Application type from Google Cloud Console)
  const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
  // Paste your Anthropic API key here
  const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_KEY_HERE';
  const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
  const MAX_FILE_SIZE_MB = 10;
  // ────────────────────────────────────────────────────────────────────────────

  // ─── UTILITIES ────────────────────────────────────────────────────────────────

  /** Escape HTML special characters to prevent XSS when injecting into innerHTML. */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Escape content for use inside a <textarea> rendered via innerHTML. */
  function escTextarea(str) {
    if (str == null) return '';
    // In a textarea context, we only need to escape the closing tag sequence
    return String(str).replace(/<\//g, '&lt;/');
  }

  /** Simple debounce helper. */
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ─── STATE ──────────────────────────────────────────────────────────────────
  let state = {
    accessToken: GM_getValue('gAccessToken', null),
    tokenExpiry: GM_getValue('gTokenExpiry', 0),
    sidebarOpen: false,
    activeTab: 'content',         // 'content' | 'grader'
    contentStep: 'upload',        // 'upload' | 'recs' | 'build'
    graderStep: 'criteria',       // 'criteria' | 'results' | 'summary'
    currentCourse: null,
    courses: [],
    assignments: [],
    submissions: [],
    selectedAssignment: null,     // BUG FIX: was missing from original
    selectedTypes: [],
    showAllTypes: false,          // NEW: controls full type grid visibility
    topicText: '',
    uploadedFileName: '',
    uploadedFileB64: '',
    uploadedFileMime: '',
    rubricText: '',
    strictness: 'balanced',
    feedbackStyle: 'encouraging',
    aiRecs: [],
    pickedRec: null,
    buildTitle: '',
    buildDesc: '',
    buildPoints: '20',
    buildDue: '',
    gradingResults: [],
    isLoading: false,
    loadingMsg: '',
    toasts: [],                   // NEW: in-sidebar notifications
    returningAll: false,          // NEW: bulk return progress flag
    returnProgress: 0,            // NEW: how many returned so far
    returnTotal: 0,               // NEW: total to return
  };

  let toastId = 0;

  /** Show an in-sidebar toast notification instead of alert(). */
  function showToast(message, type = 'info', duration = 4000) {
    const id = ++toastId;
    state.toasts.push({ id, message, type });
    render();
    if (duration > 0) {
      setTimeout(() => {
        state.toasts = state.toasts.filter(t => t.id !== id);
        render();
      }, duration);
    }
  }

  // ─── STYLES ─────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #cai-toggle {
      position: fixed; right: 0; top: 50%;
      transform: translateY(-50%);
      width: 36px; height: 72px;
      background: #534AB7; color: #fff;
      border: none; border-radius: 8px 0 0 8px;
      cursor: pointer; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      box-shadow: -2px 0 8px rgba(0,0,0,0.15);
      transition: background 0.15s;
      writing-mode: vertical-lr;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.05em;
      font-family: 'Google Sans', sans-serif;
    }
    #cai-toggle:hover { background: #3C3489; }

    #cai-sidebar {
      position: fixed; right: -420px; top: 0;
      width: 420px; height: 100vh;
      background: #fff; z-index: 99998;
      border-left: 1px solid #e0e0e0;
      box-shadow: -4px 0 20px rgba(0,0,0,0.1);
      transition: right 0.25s ease;
      display: flex; flex-direction: column;
      font-family: 'Google Sans', Roboto, sans-serif;
      font-size: 14px; color: #202124;
      overflow: hidden;
    }
    #cai-sidebar.open { right: 0; }

    .cai-header {
      background: #534AB7; color: #fff;
      padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .cai-header h1 { font-size: 15px; font-weight: 500; margin: 0; }
    .cai-close {
      background: none; border: none; color: #fff;
      cursor: pointer; font-size: 20px; line-height: 1; padding: 0 4px;
    }

    .cai-nav {
      display: flex; border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0; background: #fff;
    }
    .cai-nav-btn {
      flex: 1; padding: 10px; font-size: 13px; font-weight: 500;
      color: #5f6368; border: none; background: none;
      cursor: pointer; border-bottom: 2px solid transparent;
      font-family: 'Google Sans', sans-serif;
      transition: color 0.15s;
    }
    .cai-nav-btn.active { color: #534AB7; border-bottom-color: #534AB7; }

    .cai-body {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 14px;
    }

    .cai-label {
      font-size: 11px; font-weight: 500; color: #5f6368;
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .cai-input, .cai-textarea, .cai-select {
      width: 100%; padding: 8px 10px;
      border: 1px solid #dadce0; border-radius: 6px;
      font-size: 13px; font-family: 'Google Sans', sans-serif;
      color: #202124; background: #fff;
      box-sizing: border-box;
    }
    .cai-input:focus, .cai-textarea:focus, .cai-select:focus {
      outline: none; border-color: #534AB7;
    }
    .cai-textarea { resize: vertical; }

    .cai-upload-zone {
      border: 1.5px dashed #dadce0; border-radius: 8px;
      padding: 20px; text-align: center; cursor: pointer;
      background: #f8f9fa; transition: border-color 0.15s;
    }
    .cai-upload-zone:hover { border-color: #534AB7; }
    .cai-upload-zone p { font-size: 13px; color: #5f6368; margin: 4px 0 2px; }
    .cai-upload-zone span { font-size: 11px; color: #9aa0a6; }
    .cai-upload-zone.has-file { border-color: #1D9E75; background: #E1F5EE; }
    .cai-upload-zone.has-file p { color: #085041; font-weight: 500; }

    .cai-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .cai-chip {
      font-size: 12px; padding: 4px 12px; border-radius: 20px;
      border: 1px solid #dadce0; color: #5f6368;
      cursor: pointer; background: #fff;
      transition: all 0.12s;
    }
    .cai-chip.sel { background: #EEEDFE; border-color: #AFA9EC; color: #3C3489; font-weight: 500; }
    .cai-chip.sel.teal { background: #E1F5EE; border-color: #5DCAA5; color: #085041; }
    .cai-chip.sel.amber { background: #FAEEDA; border-color: #EF9F27; color: #633806; }

    .cai-btn {
      padding: 8px 16px; border-radius: 6px; font-size: 13px;
      cursor: pointer; border: 1px solid #dadce0;
      background: #fff; color: #202124;
      font-family: 'Google Sans', sans-serif; font-weight: 500;
      transition: background 0.12s;
    }
    .cai-btn:hover { background: #f8f9fa; }
    .cai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .cai-btn.primary {
      background: #534AB7; border-color: #534AB7; color: #fff;
    }
    .cai-btn.primary:hover { background: #3C3489; }
    .cai-btn.danger {
      background: #E24B4A; border-color: #E24B4A; color: #fff;
    }
    .cai-btn.danger:hover { background: #C13030; }
    .cai-btn-row { display: flex; gap: 8px; }
    .cai-btn-row .cai-btn { flex: 1; }

    .cai-steps {
      display: flex; gap: 0; border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0; padding: 0 16px; background: #f8f9fa;
    }
    .cai-step {
      font-size: 12px; padding: 8px 12px; color: #9aa0a6;
      border-bottom: 2px solid transparent; cursor: pointer;
    }
    .cai-step.active { color: #534AB7; border-bottom-color: #534AB7; font-weight: 500; }
    .cai-step.done { color: #1D9E75; }

    .cai-rec-card {
      border: 1px solid #dadce0; border-radius: 8px;
      padding: 12px 14px; cursor: pointer;
      transition: border-color 0.12s;
    }
    .cai-rec-card:hover { border-color: #9aa0a6; }
    .cai-rec-card.picked { border: 2px solid #534AB7; }
    .cai-rec-card h4 { font-size: 13px; font-weight: 500; margin: 6px 0 3px; }
    .cai-rec-card p { font-size: 12px; color: #5f6368; line-height: 1.5; }
    .cai-rec-card .meta { font-size: 11px; color: #9aa0a6; margin-top: 6px; }

    .cai-badge {
      display: inline-block; font-size: 10px; font-weight: 500;
      padding: 2px 8px; border-radius: 20px;
    }
    .cai-badge.purple { background: #EEEDFE; color: #3C3489; }
    .cai-badge.teal   { background: #E1F5EE; color: #085041; }
    .cai-badge.amber  { background: #FAEEDA; color: #633806; }
    .cai-badge.blue   { background: #E6F1FB; color: #0C447C; }
    .cai-badge.pink   { background: #FBEAF0; color: #72243E; }

    .cai-sub-card {
      border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
    }
    .cai-sub-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .cai-sub-top h4 { font-size: 13px; font-weight: 500; }
    .cai-sub-top .ts { font-size: 11px; color: #9aa0a6; margin-top: 2px; }
    .cai-grade-pill {
      font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 20px;
      white-space: nowrap;
    }
    .grade-a { background: #EAF3DE; color: #27500A; }
    .grade-b { background: #E6F1FB; color: #0C447C; }
    .grade-c { background: #FAEEDA; color: #633806; }
    .grade-d { background: #FCEBEB; color: #791F1F; }
    .cai-fb {
      background: #f8f9fa; border-radius: 6px; padding: 10px;
      font-size: 12px; color: #5f6368; line-height: 1.6;
    }
    .cai-conf { margin-top: 4px; }
    .cai-conf-labels {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9aa0a6; margin-bottom: 3px;
    }
    .cai-conf-track {
      height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;
    }
    .cai-conf-fill { height: 100%; border-radius: 2px; }

    .cai-stat-grid {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
    }
    .cai-stat {
      background: #f8f9fa; border-radius: 8px;
      padding: 10px; text-align: center;
    }
    .cai-stat .n { font-size: 22px; font-weight: 500; }
    .cai-stat .l { font-size: 11px; color: #5f6368; margin-top: 2px; }

    .cai-loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; padding: 40px 20px; color: #5f6368;
    }
    .cai-spinner {
      width: 28px; height: 28px;
      border: 3px solid #e0e0e0;
      border-top-color: #534AB7;
      border-radius: 50%;
      animation: cai-spin 0.8s linear infinite;
    }
    @keyframes cai-spin { to { transform: rotate(360deg); } }

    .cai-divider { height: 1px; background: #e0e0e0; }

    .cai-auth-screen {
      flex: 1; overflow-y: auto;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; padding: 40px 24px; text-align: center;
    }
    .cai-auth-screen h2 { font-size: 16px; font-weight: 500; }
    .cai-auth-screen p { font-size: 13px; color: #5f6368; line-height: 1.6; }

    .cai-type-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }
    .cai-type-card {
      border: 1px solid #dadce0; border-radius: 8px;
      padding: 10px 12px; cursor: pointer;
      transition: border-color 0.12s;
    }
    .cai-type-card:hover { border-color: #9aa0a6; }
    .cai-type-card.sel { border: 1.5px solid #534AB7; background: #EEEDFE; }
    .cai-type-card h5 { font-size: 12px; font-weight: 500; margin: 4px 0 2px; }
    .cai-type-card p { font-size: 11px; color: #5f6368; }

    .cai-notice {
      background: #E6F1FB; border-radius: 6px; padding: 10px 12px;
      font-size: 12px; color: #0C447C; line-height: 1.5;
    }
    .cai-error {
      background: #FCEBEB; border-radius: 6px; padding: 10px 12px;
      font-size: 12px; color: #791F1F; line-height: 1.5;
    }

    /* Toast notifications */
    .cai-toast-container {
      position: absolute; bottom: 12px; left: 12px; right: 12px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 10; pointer-events: none;
    }
    .cai-toast {
      padding: 10px 14px; border-radius: 8px;
      font-size: 12px; line-height: 1.5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      pointer-events: auto;
      animation: cai-toast-in 0.2s ease;
    }
    .cai-toast.info    { background: #E6F1FB; color: #0C447C; }
    .cai-toast.success { background: #E1F5EE; color: #085041; }
    .cai-toast.error   { background: #FCEBEB; color: #791F1F; }
    .cai-toast.warning { background: #FAEEDA; color: #633806; }
    @keyframes cai-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Course selector */
    .cai-course-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0; flex-shrink: 0;
    }
    .cai-course-bar label {
      font-size: 11px; font-weight: 500; color: #5f6368;
      text-transform: uppercase; letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .cai-course-bar select {
      flex: 1; font-size: 12px; padding: 4px 8px;
      border: 1px solid #dadce0; border-radius: 4px;
      font-family: 'Google Sans', sans-serif;
      background: #fff;
    }

    /* Token expiry warning */
    .cai-token-warn {
      background: #FAEEDA; color: #633806;
      font-size: 11px; padding: 6px 16px;
      text-align: center; flex-shrink: 0;
    }

    /* Progress bar for bulk operations */
    .cai-progress-bar {
      height: 3px; background: #e0e0e0; border-radius: 2px;
      overflow: hidden; margin-top: 4px;
    }
    .cai-progress-fill {
      height: 100%; background: #534AB7; border-radius: 2px;
      transition: width 0.3s ease;
    }
  `);

  // ─── CONTENT TYPES ──────────────────────────────────────────────────────────
  const CONTENT_TYPES = [
    { id: 'unit-test',      label: 'Unit test',            cat: 'assessment', color: 'purple' },
    { id: 'quiz',           label: 'Quiz',                 cat: 'assessment', color: 'purple' },
    { id: 'exit-ticket',    label: 'Exit ticket',          cat: 'assessment', color: 'purple' },
    { id: 'pre-assess',     label: 'Pre-assessment',       cat: 'assessment', color: 'purple' },
    { id: 'essay',          label: 'Essay prompt',         cat: 'assessment', color: 'purple' },
    { id: 'short-answer',   label: 'Short answer set',     cat: 'assessment', color: 'purple' },
    { id: 'study-guide',    label: 'Study guide',          cat: 'study',      color: 'teal'   },
    { id: 'review-sheet',   label: 'Review sheet',         cat: 'study',      color: 'teal'   },
    { id: 'flashcards',     label: 'Flashcard set',        cat: 'study',      color: 'teal'   },
    { id: 'concept-map',    label: 'Concept map',          cat: 'study',      color: 'teal'   },
    { id: 'cornell-notes',  label: 'Cornell notes',        cat: 'study',      color: 'teal'   },
    { id: 'terminology',    label: 'Terminology list',     cat: 'reference',  color: 'blue'   },
    { id: 'formula-sheet',  label: 'Formula sheet',        cat: 'reference',  color: 'blue'   },
    { id: 'reading-guide',  label: 'Reading guide',        cat: 'reference',  color: 'blue'   },
    { id: 'timeline',       label: 'Timeline',             cat: 'reference',  color: 'blue'   },
    { id: 'worksheet',      label: 'Worksheet',            cat: 'practice',   color: 'amber'  },
    { id: 'problem-set',    label: 'Problem set',          cat: 'practice',   color: 'amber'  },
    { id: 'graphic-org',    label: 'Graphic organizer',    cat: 'practice',   color: 'amber'  },
    { id: 'discussion',     label: 'Discussion prompt',    cat: 'practice',   color: 'amber'  },
    { id: 'lab-guide',      label: 'Lab / experiment',     cat: 'practice',   color: 'amber'  },
    { id: 'project-brief',  label: 'Project brief',        cat: 'creative',   color: 'pink'   },
    { id: 'case-study',     label: 'Case study',           cat: 'creative',   color: 'pink'   },
    { id: 'debate',         label: 'Debate / position',    cat: 'creative',   color: 'pink'   },
    { id: 'socratic',       label: 'Socratic seminar',     cat: 'creative',   color: 'pink'   },
  ];

  // Build a lookup map: content-type label -> color (for AI recommendation rendering)
  const TYPE_COLOR_MAP = {};
  CONTENT_TYPES.forEach(t => { TYPE_COLOR_MAP[t.label.toLowerCase()] = t.color; });

  // ─── AUTH ────────────────────────────────────────────────────────────────────
  function isTokenValid() {
    return state.accessToken && Date.now() < state.tokenExpiry - 60000;
  }

  /** Returns true if the token is valid but expiring within 10 minutes. */
  function isTokenExpiringSoon() {
    if (!state.accessToken) return false;
    const remaining = state.tokenExpiry - Date.now();
    return remaining > 0 && remaining < 10 * 60 * 1000;
  }

  function launchOAuth() {
    const redirectUri = `https://${window.location.host}`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.me',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.rosters.readonly',
      ].join(' '),
      prompt: 'select_account',
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    const popup = window.open(url, 'cai_oauth', 'width=500,height=600,left=400,top=100');

    if (!popup) {
      showToast('Pop-up blocked — please allow pop-ups for this site and try again.', 'error', 6000);
      return;
    }

    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          return;
        }
        const hash = popup.location.hash;
        if (hash && hash.includes('access_token')) {
          clearInterval(timer);
          popup.close();
          const p = new URLSearchParams(hash.slice(1));
          state.accessToken = p.get('access_token');
          state.tokenExpiry = Date.now() + parseInt(p.get('expires_in'), 10) * 1000;
          GM_setValue('gAccessToken', state.accessToken);
          GM_setValue('gTokenExpiry', state.tokenExpiry);
          showToast('Signed in successfully!', 'success');
          loadCourses().then(render).catch(err => {
            console.error('CAI: Failed to load courses after auth', err);
            showToast('Signed in, but failed to load courses. Try reopening the sidebar.', 'warning');
          });
        }
      } catch (_) {
        // Expected cross-origin error until OAuth redirect completes
      }
    }, 500);
  }

  function signOut() {
    state.accessToken = null;
    state.tokenExpiry = 0;
    state.courses = [];
    state.currentCourse = null;
    state.assignments = [];
    state.submissions = [];
    GM_setValue('gAccessToken', null);
    GM_setValue('gTokenExpiry', 0);
    showToast('Signed out.', 'info');
    render();
  }

  // ─── API HELPERS ─────────────────────────────────────────────────────────────

  /**
   * Make a GET request to the Google Classroom API.
   * @param {string} path - API path (e.g. '/courses')
   * @returns {Promise<Object>}
   */
  function classroomGET(path) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://classroom.googleapis.com/v1${path}`,
        headers: { Authorization: `Bearer ${state.accessToken}` },
        onload: r => {
          try {
            const d = JSON.parse(r.responseText);
            if (r.status >= 400) {
              reject(new Error(d.error?.message || `HTTP ${r.status}`));
            } else {
              resolve(d);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${r.responseText.slice(0, 200)}`));
          }
        },
        onerror: err => reject(new Error('Network error on GET ' + path)),
      });
    });
  }

  /**
   * Make a POST request to the Google Classroom API.
   * @param {string} path - API path
   * @param {Object} body - Request body
   * @returns {Promise<Object>}
   */
  function classroomPOST(path, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `https://classroom.googleapis.com/v1${path}`,
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(body),
        onload: r => {
          try {
            const d = JSON.parse(r.responseText);
            if (r.status >= 400) {
              reject(new Error(d.error?.message || `HTTP ${r.status}`));
            } else {
              resolve(d);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${r.responseText.slice(0, 200)}`));
          }
        },
        onerror: err => reject(new Error('Network error on POST ' + path)),
      });
    });
  }

  /**
   * Make a PATCH request to the Google Classroom API.
   * @param {string} url - Full API URL
   * @param {Object} body - Request body
   * @returns {Promise<Object>}
   */
  function classroomPATCH(url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'PATCH',
        url,
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(body),
        onload: r => {
          try {
            const d = JSON.parse(r.responseText);
            if (r.status >= 400) {
              reject(new Error(d.error?.message || `HTTP ${r.status}`));
            } else {
              resolve(d);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${r.responseText.slice(0, 200)}`));
          }
        },
        onerror: err => reject(new Error('Network error on PATCH')),
      });
    });
  }

  /**
   * Call the Anthropic Claude API with streaming support.
   * BUG FIX: Tracks stream parse offset to avoid re-processing earlier chunks.
   *
   * @param {string} systemPrompt - System message
   * @param {string|Array} userMsg - User message (string or content array)
   * @param {Function|null} onChunk - Callback receiving accumulated text so far
   * @returns {Promise<string>} Full response text
   */
  function claudeCall(systemPrompt, userMsg, onChunk) {
    return new Promise((resolve, reject) => {
      let full = '';
      let parseOffset = 0; // Track how far we've parsed to avoid duplicates

      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        data: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
        onprogress: r => {
          // Only parse new data since last offset
          const newData = r.responseText.slice(parseOffset);
          parseOffset = r.responseText.length;

          const lines = newData.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'content_block_delta' && ev.delta?.text) {
                full += ev.delta.text;
                if (onChunk) onChunk(full);
              }
              if (ev.type === 'error') {
                console.error('CAI: Claude stream error', ev.error);
              }
            } catch (_) {
              // Incomplete JSON chunk — will be completed in next onprogress
            }
          }
        },
        onload: () => resolve(full),
        onerror: err => reject(new Error('Network error calling Claude API')),
      });
    });
  }

  // ─── CLASSROOM DATA ──────────────────────────────────────────────────────────

  /** Load all active courses (handles pagination). */
  async function loadCourses() {
    let allCourses = [];
    let pageToken = null;
    do {
      const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
      const data = await classroomGET(`/courses?courseStates=ACTIVE&pageSize=20${tokenParam}`);
      allCourses = allCourses.concat(data.courses || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    state.courses = allCourses;
    if (state.courses.length && !state.currentCourse) {
      state.currentCourse = state.courses[0];
    }
  }

  /** Load assignments for the current course (handles pagination). */
  async function loadAssignments() {
    if (!state.currentCourse) return;
    let allWork = [];
    let pageToken = null;
    do {
      const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
      const data = await classroomGET(
        `/courses/${state.currentCourse.id}/courseWork?pageSize=30&orderBy=updateTime desc${tokenParam}`
      );
      allWork = allWork.concat(data.courseWork || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);
    state.assignments = allWork;
  }

  /** Load student submissions for a specific assignment (handles pagination). */
  async function loadSubmissions(courseWorkId) {
    if (!state.currentCourse) return;
    let allSubs = [];
    let pageToken = null;
    do {
      const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
      const data = await classroomGET(
        `/courses/${state.currentCourse.id}/courseWork/${courseWorkId}/studentSubmissions?pageSize=60${tokenParam}`
      );
      allSubs = allSubs.concat(data.studentSubmissions || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);
    state.submissions = allSubs;
  }

  /** Post a new assignment as a Draft. */
  async function postAssignment(title, description, points, dueDate) {
    const courseId = state.currentCourse.id;
    const body = {
      title,
      description,
      maxPoints: parseInt(points, 10) || 100,
      workType: 'ASSIGNMENT',
      state: 'DRAFT',
    };
    if (dueDate) {
      const d = new Date(dueDate);
      body.dueDate = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
      body.dueTime = { hours: 23, minutes: 59 };
    }
    return classroomPOST(`/courses/${courseId}/courseWork`, body);
  }

  /**
   * Assign a grade and return a submission to the student.
   * BUG FIX: PATCH call is now properly promisified via classroomPATCH.
   */
  async function returnSubmission(courseId, courseWorkId, submissionId, grade) {
    const patchUrl = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}?updateMask=assignedGrade,draftGrade`;
    await classroomPATCH(patchUrl, { assignedGrade: grade, draftGrade: grade });
    return classroomPOST(
      `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}:return`,
      {}
    );
  }

  // ─── AI CONTENT GENERATION ───────────────────────────────────────────────────

  /** Generate 3 content recommendations based on source material. */
  async function generateContentRecs() {
    state.isLoading = true;
    state.loadingMsg = 'Analyzing your material...';
    render();

    const types = state.selectedTypes.length
      ? state.selectedTypes.map(id => CONTENT_TYPES.find(t => t.id === id)?.label).filter(Boolean).join(', ')
      : 'any appropriate types';

    const system = `You are an expert curriculum designer. Analyze the teacher's source material or topic and recommend 3 specific content items.
Return ONLY valid JSON — an array of exactly 3 objects with keys: type, title, description, estimatedMinutes, points, rationale.
"type" must be one of: ${CONTENT_TYPES.map(t => t.label).join(', ')}.`;

    const user = state.uploadedFileB64
      ? [
          { type: 'text', text: `Topic context: ${state.topicText || 'See attached file'}\nRequested types: ${types}\nRecommend 3 content items.` },
          { type: 'document', source: { type: 'base64', media_type: state.uploadedFileMime, data: state.uploadedFileB64 } },
        ]
      : `Topic: ${state.topicText}\nRequested types: ${types}\nRecommend 3 content items as JSON.`;

    try {
      const raw = await claudeCall(system, user, null);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      state.aiRecs = JSON.parse(cleaned);
      if (!Array.isArray(state.aiRecs)) {
        throw new Error('Expected an array of recommendations');
      }
      state.contentStep = 'recs';
    } catch (e) {
      console.error('CAI: rec generation error', e);
      showToast('Failed to generate recommendations. Please try again.', 'error');
    }
    state.isLoading = false;
    render();
  }

  /** Generate full content for a selected recommendation (streams into build view). */
  async function generateFullContent(rec) {
    state.isLoading = true;
    state.loadingMsg = `Building your ${esc(rec.type)}...`;
    state.contentStep = 'build';
    state.buildTitle = rec.title;
    state.buildPoints = String(rec.points || 20);
    render();

    const system = `You are an expert curriculum designer. Generate complete, classroom-ready content for a teacher. Be thorough and specific. Format clearly with sections a teacher can copy directly into Google Classroom.`;
    const user = `Create a complete "${rec.type}" titled "${rec.title}" about this topic: ${state.topicText || 'the uploaded material'}.
Details: ${rec.description}
Target points: ${rec.points}
Estimated time: ${rec.estimatedMinutes} minutes
Make it complete and ready to post.`;

    try {
      let built = '';
      await claudeCall(system, user, text => {
        state.buildDesc = text;
        built = text;
        render();
      });
      state.buildDesc = built;
    } catch (e) {
      console.error('CAI: content build error', e);
      showToast('Failed to generate content. Please try again.', 'error');
    }
    state.isLoading = false;
    render();
  }

  // ─── AI GRADING ──────────────────────────────────────────────────────────────

  /** Grade all turned-in submissions for a given assignment. */
  async function gradeAllSubmissions(assignment) {
    state.isLoading = true;
    state.loadingMsg = 'Loading submissions...';
    state.graderStep = 'results';
    state.gradingResults = [];
    render();

    try {
      await loadSubmissions(assignment.id);
    } catch (e) {
      console.error('CAI: Failed to load submissions', e);
      showToast('Failed to load submissions. Check your permissions.', 'error');
      state.isLoading = false;
      render();
      return;
    }

    const turned = state.submissions.filter(s => s.state === 'TURNED_IN');
    if (turned.length === 0) {
      showToast('No turned-in submissions found for this assignment.', 'warning');
      state.isLoading = false;
      render();
      return;
    }

    state.loadingMsg = `Grading ${turned.length} submission${turned.length !== 1 ? 's' : ''} with AI...`;
    render();

    const system = `You are an expert teacher assistant. Grade a student submission based on the provided rubric.
Return ONLY valid JSON with keys: score (number), maxScore (number), grade (A/B/C/D/F), feedback (string, 2-4 sentences, personalized and ${state.feedbackStyle}), confidence (0-100), issues (array of short strings).
Strictness level: ${state.strictness}.`;

    for (let idx = 0; idx < turned.length; idx++) {
      const sub = turned[idx];
      state.loadingMsg = `Grading submission ${idx + 1} of ${turned.length}...`;
      render();

      const submissionText = extractSubmissionText(sub);
      const user = `Assignment: ${assignment.title}
Max points: ${assignment.maxPoints || 100}
Rubric: ${state.rubricText}
Student submission: ${submissionText || '[No text content — attachment based submission]'}
Grade this submission.`;

      try {
        const raw = await claudeCall(system, user, null);
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleaned);
        // Validate expected fields
        if (typeof result.score !== 'number' || typeof result.feedback !== 'string') {
          throw new Error('Invalid response structure');
        }
        state.gradingResults.push({ sub, result, edited: false, returned: false });
      } catch (e) {
        console.error('CAI: grading error for submission', sub.id, e);
        state.gradingResults.push({
          sub,
          result: {
            score: 0,
            maxScore: assignment.maxPoints || 100,
            grade: '?',
            feedback: 'Could not grade — manual review needed.',
            confidence: 0,
            issues: [],
          },
          edited: false,
          returned: false,
          error: true,
        });
      }
      render();
    }

    state.isLoading = false;
    showToast(`Finished grading ${turned.length} submission${turned.length !== 1 ? 's' : ''}.`, 'success');
    render();
  }

  /** Extract readable text from a student submission object. */
  function extractSubmissionText(sub) {
    if (sub.shortAnswerSubmission?.answer) return sub.shortAnswerSubmission.answer;
    if (sub.multipleChoiceSubmission?.answer) return `Selected: ${sub.multipleChoiceSubmission.answer}`;
    if (sub.assignmentSubmission?.attachments) {
      return sub.assignmentSubmission.attachments
        .map(a => a.link?.url || a.driveFile?.title || '')
        .filter(Boolean).join(', ');
    }
    return '';
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  function render() {
    const sidebar = document.getElementById('cai-sidebar');
    if (!sidebar) return;

    try {
      const notConfigured = GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'
        || ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_KEY_HERE';

      sidebar.innerHTML = `
        <div class="cai-header">
          <h1>AI Assistant</h1>
          <div style="display:flex;align-items:center;gap:8px">
            ${isTokenValid() ? '<button class="cai-close" onclick="window.caiSignOut()" title="Sign out" style="font-size:13px">Sign out</button>' : ''}
            <button class="cai-close" onclick="window.caiClose()" title="Close sidebar">&times;</button>
          </div>
        </div>

        ${notConfigured ? renderSetupScreen() : !isTokenValid() ? renderAuthScreen() : renderMain()}
        ${renderToasts()}
      `;
    } catch (err) {
      console.error('CAI: render error', err);
      sidebar.innerHTML = `
        <div style="background:#534AB7;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
          <h1 style="font-size:15px;font-weight:500;margin:0">AI Assistant</h1>
          <button onclick="window.caiClose()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px">&times;</button>
        </div>
        <div style="padding:20px;font-family:monospace;font-size:12px;color:#791F1F;background:#FCEBEB;margin:16px;border-radius:8px;overflow-wrap:break-word">
          <strong>Render error:</strong><br>${esc(err.message || String(err))}
        </div>
      `;
    }
  }

  function renderToasts() {
    if (!state.toasts.length) return '';
    return `<div class="cai-toast-container">
      ${state.toasts.map(t => `<div class="cai-toast ${esc(t.type)}">${esc(t.message)}</div>`).join('')}
    </div>`;
  }

  function renderSetupScreen() {
    return `
      <div class="cai-auth-screen">
        <div style="font-size:32px">&#9881;&#65039;</div>
        <h2>Setup required</h2>
        <p>Open the script in Tampermonkey's editor and fill in your<br>
        <strong>GOOGLE_CLIENT_ID</strong> and <strong>ANTHROPIC_API_KEY</strong><br>
        at the top of the file.</p>
        <div class="cai-notice" style="text-align:left">
          <strong>Need a Client ID?</strong><br>
          1. Go to <code>console.cloud.google.com</code><br>
          2. Create a project, then enable the <strong>Google Classroom API</strong><br>
          3. OAuth consent screen &rarr; External &rarr; add your Google account as a test user<br>
          4. Credentials &rarr; OAuth 2.0 Client ID &rarr; Web application<br>
          5. Add <code>https://classroom.google.com</code> as an <strong>Authorized JavaScript origin</strong><br>
          6. Copy the Client ID into this script
        </div>
      </div>`;
  }

  function renderAuthScreen() {
    return `
      <div class="cai-auth-screen">
        <div style="font-size:32px">&#128274;</div>
        <h2>Connect to Classroom</h2>
        <p>Sign in with your Google account to allow the assistant to read your classes and post content.</p>
        <button class="cai-btn primary" onclick="window.caiAuth()" style="width:100%">Sign in with Google</button>
      </div>`;
  }

  function renderMain() {
    const tokenWarn = isTokenExpiringSoon()
      ? `<div class="cai-token-warn">Your session expires soon. <a href="#" onclick="window.caiAuth();return false" style="color:#633806;font-weight:500">Re-authenticate</a></div>`
      : '';

    const courseBar = state.courses.length > 0 ? `
      <div class="cai-course-bar">
        <label>Class:</label>
        <select onchange="window.caiSwitchCourse(this.value)">
          ${state.courses.map(c =>
            `<option value="${esc(c.id)}" ${state.currentCourse?.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
          ).join('')}
        </select>
      </div>` : '';

    return `
      ${tokenWarn}
      ${courseBar}
      <div class="cai-nav">
        <button class="cai-nav-btn ${state.activeTab === 'content' ? 'active' : ''}" onclick="window.caiTab('content')">Content creator</button>
        <button class="cai-nav-btn ${state.activeTab === 'grader' ? 'active' : ''}" onclick="window.caiTab('grader')">Auto-grader</button>
      </div>
      ${state.isLoading ? renderLoading() : state.activeTab === 'content' ? renderContent() : renderGrader()}
    `;
  }

  function renderLoading() {
    return `<div class="cai-loading"><div class="cai-spinner"></div><p>${esc(state.loadingMsg)}</p></div>`;
  }

  // ─── CONTENT TAB ─────────────────────────────────────────────────────────────

  function renderContent() {
    const steps = [
      { id: 'upload', label: '1 Upload' },
      { id: 'recs',   label: '2 Suggestions' },
      { id: 'build',  label: '3 Build & post' },
    ];
    const stepIdx = steps.findIndex(s => s.id === state.contentStep);

    return `
      <div class="cai-steps">
        ${steps.map((s, i) => `
          <div class="cai-step ${s.id === state.contentStep ? 'active' : i < stepIdx ? 'done' : ''}"
               onclick="window.caiContentStep('${s.id}')">${s.label}</div>
        `).join('')}
      </div>
      <div class="cai-body">
        ${state.contentStep === 'upload' ? renderUpload() : ''}
        ${state.contentStep === 'recs'   ? renderRecs()   : ''}
        ${state.contentStep === 'build'  ? renderBuild()  : ''}
      </div>
    `;
  }

  function renderUpload() {
    const hasFile = !!state.uploadedFileName;
    const typesToShow = state.showAllTypes ? CONTENT_TYPES : CONTENT_TYPES.slice(0, 12);
    return `
      <div>
        <div class="cai-label">Source material</div>
        <div class="cai-upload-zone ${hasFile ? 'has-file' : ''}" onclick="document.getElementById('cai-file-input').click()">
          <p>${hasFile ? '&#10003; ' + esc(state.uploadedFileName) : 'Drop a PDF, PPTX, or DOCX'}</p>
          <span>${hasFile ? 'Click to replace' : 'or click to browse'}</span>
        </div>
        <input type="file" id="cai-file-input" accept=".pdf,.pptx,.docx,.txt" style="display:none" onchange="window.caiFileChange(this)">
      </div>
      <div>
        <div class="cai-label">Or describe your topic</div>
        <textarea class="cai-textarea" rows="3" placeholder="e.g. Cell division and mitosis, grade 10 biology..."
          oninput="window.caiTopicInput(this.value)">${escTextarea(state.topicText)}</textarea>
      </div>
      <div>
        <div class="cai-label">Content types to generate</div>
        <div class="cai-type-grid">
          ${typesToShow.map(t => `
            <div class="cai-type-card ${state.selectedTypes.includes(t.id) ? 'sel' : ''}"
                 onclick="window.caiToggleType('${t.id}')">
              <div class="cai-badge ${t.color}">${esc(t.cat)}</div>
              <h5>${esc(t.label)}</h5>
            </div>
          `).join('')}
        </div>
        ${!state.showAllTypes ? `
          <button class="cai-btn" style="width:100%;margin-top:8px;font-size:12px" onclick="window.caiShowAllTypes()">
            Show all ${CONTENT_TYPES.length} types...
          </button>` : `
          <button class="cai-btn" style="width:100%;margin-top:8px;font-size:12px" onclick="window.caiCollapseTypes()">
            Show fewer types
          </button>`}
      </div>
      <button class="cai-btn primary" onclick="window.caiGenerateRecs()"
        ${(!state.topicText && !state.uploadedFileB64) ? 'disabled' : ''}>
        Analyze &amp; suggest &rarr;
      </button>
    `;
  }

  function renderRecs() {
    if (!state.aiRecs.length) return `<p style="color:#5f6368;font-size:13px">No suggestions yet — go back to upload.</p>`;

    return `
      <p style="font-size:12px;color:#5f6368">AI analyzed your material. Pick one to build, or go back to select more types.</p>
      ${state.aiRecs.map((r, i) => {
        // FIX: Look up color by the content type label (case-insensitive) instead of category name
        const color = TYPE_COLOR_MAP[(r.type || '').toLowerCase()] || 'purple';
        return `
          <div class="cai-rec-card ${state.pickedRec === i ? 'picked' : ''}" onclick="window.caiPickRec(${i})">
            <div class="cai-badge ${color}">${esc(r.type)}</div>
            <h4>${esc(r.title)}</h4>
            <p>${esc(r.description)}</p>
            <div class="meta">Est. ${esc(r.estimatedMinutes)} min &middot; ${esc(r.points)} pts</div>
          </div>`;
      }).join('')}
      <div class="cai-btn-row">
        <button class="cai-btn" onclick="window.caiContentStep('upload')">&larr; Back</button>
        <button class="cai-btn primary" onclick="window.caiBuildRec()"
          ${state.pickedRec === null ? 'disabled' : ''}>Build selected &rarr;</button>
      </div>
    `;
  }

  function renderBuild() {
    return `
      <div>
        <div class="cai-label">Title</div>
        <input class="cai-input" value="${esc(state.buildTitle)}" oninput="window.caiBuildField('title',this.value)">
      </div>
      <div>
        <div class="cai-label">Content / instructions</div>
        <textarea class="cai-textarea" rows="8" oninput="window.caiBuildField('desc',this.value)">${escTextarea(state.buildDesc)}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div class="cai-label">Points</div>
          <input class="cai-input" type="number" min="0" value="${esc(state.buildPoints)}" oninput="window.caiBuildField('points',this.value)">
        </div>
        <div>
          <div class="cai-label">Due date</div>
          <input class="cai-input" type="date" value="${esc(state.buildDue)}" oninput="window.caiBuildField('due',this.value)">
        </div>
      </div>
      <div class="cai-notice" style="font-size:11px">
        Will post as a <strong>Draft</strong> to: <strong>${esc(state.currentCourse?.name || 'current class')}</strong>
      </div>
      <div class="cai-btn-row">
        <button class="cai-btn" onclick="window.caiContentStep('recs')">&larr; Back</button>
        <button class="cai-btn primary" onclick="window.caiPostAssignment()">Post to Classroom &rarr;</button>
      </div>
    `;
  }

  // ─── GRADER TAB ──────────────────────────────────────────────────────────────

  function renderGrader() {
    const steps = [
      { id: 'criteria', label: '1 Criteria' },
      { id: 'results',  label: '2 Results'  },
      { id: 'summary',  label: '3 Summary'  },
    ];
    const stepIdx = steps.findIndex(s => s.id === state.graderStep);
    return `
      <div class="cai-steps">
        ${steps.map((s, i) => `
          <div class="cai-step ${s.id === state.graderStep ? 'active' : i < stepIdx ? 'done' : ''}"
               onclick="window.caiGraderStep('${s.id}')">${s.label}</div>
        `).join('')}
      </div>
      <div class="cai-body">
        ${state.graderStep === 'criteria' ? renderCriteria() : ''}
        ${state.graderStep === 'results'  ? renderResults()  : ''}
        ${state.graderStep === 'summary'  ? renderSummary()  : ''}
      </div>
    `;
  }

  function renderCriteria() {
    return `
      <div>
        <div class="cai-label">Assignment to grade</div>
        <select class="cai-select" onchange="window.caiSelectAssignment(this.value)">
          <option value="">— select —</option>
          ${state.assignments.map(a =>
            `<option value="${esc(a.id)}" ${state.selectedAssignment?.id === a.id ? 'selected' : ''}>${esc(a.title)}</option>`
          ).join('')}
        </select>
        ${!state.assignments.length ? `<p style="font-size:12px;color:#9aa0a6;margin-top:6px">Loading assignments...</p>` : ''}
      </div>
      <div>
        <div class="cai-label">Your grading rubric</div>
        <textarea class="cai-textarea" rows="5"
          placeholder="Describe your criteria, e.g.&#10;Accuracy (8 pts): all facts correct&#10;Analysis (8 pts): connects concepts&#10;Writing (4 pts): clear and organized"
          oninput="window.caiRubricInput(this.value)">${escTextarea(state.rubricText)}</textarea>
      </div>
      <div>
        <div class="cai-label">Strictness</div>
        <div class="cai-chip-row">
          ${['lenient','balanced','strict'].map(s => `
            <div class="cai-chip ${state.strictness === s ? 'sel' : ''}" onclick="window.caiStrictness('${s}')">${s}</div>
          `).join('')}
        </div>
      </div>
      <div>
        <div class="cai-label">Feedback tone</div>
        <div class="cai-chip-row">
          ${['encouraging','direct','detailed'].map(s => `
            <div class="cai-chip ${state.feedbackStyle === s ? 'sel teal' : ''}" onclick="window.caiFeedback('${s}')">${s}</div>
          `).join('')}
        </div>
      </div>
      <button class="cai-btn primary" onclick="window.caiGradeAll()"
        ${(!state.selectedAssignment || !state.rubricText) ? 'disabled' : ''}>
        Grade all submissions &rarr;
      </button>
    `;
  }

  function renderResults() {
    if (!state.gradingResults.length) {
      return `<p style="font-size:13px;color:#5f6368">No graded results yet.</p>`;
    }

    // Show bulk-return progress bar if active
    const progressBar = state.returningAll ? `
      <div style="margin-bottom:8px">
        <div style="font-size:12px;color:#5f6368;margin-bottom:4px">Returning ${state.returnProgress} of ${state.returnTotal}...</div>
        <div class="cai-progress-bar">
          <div class="cai-progress-fill" style="width:${state.returnTotal ? (state.returnProgress / state.returnTotal * 100) : 0}%"></div>
        </div>
      </div>` : '';

    return progressBar + state.gradingResults.map((g, i) => {
      const maxScore = g.result.maxScore || 1;
      const pct = g.result.score / maxScore;
      const gradeClass = pct >= 0.9 ? 'grade-a' : pct >= 0.75 ? 'grade-b' : pct >= 0.6 ? 'grade-c' : 'grade-d';
      const confColor = g.result.confidence >= 80 ? '#1D9E75' : g.result.confidence >= 60 ? '#BA7517' : '#E24B4A';
      const name = g.sub.userId ? `Student ${g.sub.userId.slice(-4)}` : 'Student';
      return `
        <div class="cai-sub-card ${g.error ? 'cai-error' : ''}">
          <div class="cai-sub-top">
            <div>
              <h4>${esc(name)}${g.error ? ' <span style="color:#E24B4A;font-size:11px">(needs review)</span>' : ''}</h4>
              <div class="ts">Submitted ${g.sub.updateTime ? new Date(g.sub.updateTime).toLocaleDateString() : '—'}</div>
            </div>
            <span class="cai-grade-pill ${gradeClass}">${esc(g.result.score)} / ${esc(g.result.maxScore)}</span>
          </div>
          <div class="cai-fb">${esc(g.result.feedback)}</div>
          ${(g.result.issues && g.result.issues.length) ? `
            <div style="font-size:11px;color:#9aa0a6">
              Issues: ${g.result.issues.map(issue => esc(issue)).join(', ')}
            </div>` : ''}
          <div class="cai-conf">
            <div class="cai-conf-labels"><span>AI confidence</span><span>${esc(g.result.confidence)}%</span></div>
            <div class="cai-conf-track"><div class="cai-conf-fill" style="width:${Math.min(100, Math.max(0, g.result.confidence))}%;background:${confColor}"></div></div>
          </div>
          <div class="cai-btn-row">
            <button class="cai-btn" onclick="window.caiEditGrade(${i})" style="font-size:12px">Edit grade</button>
            <button class="cai-btn primary" onclick="window.caiReturn(${i})" style="font-size:12px"
              ${g.returned ? 'disabled' : ''}>${g.returned ? 'Returned' : 'Return &rarr;'}</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderSummary() {
    if (!state.gradingResults.length) return `<p style="font-size:13px;color:#5f6368">Grade submissions first.</p>`;
    const scores = state.gradingResults.map(g => {
      const max = g.result.maxScore || 1;
      return (g.result.score / max) * 100;
    });
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const flagged = state.gradingResults.filter(g => g.result.confidence < 70).length;
    const errored = state.gradingResults.filter(g => g.error).length;
    const returned = state.gradingResults.filter(g => g.returned).length;
    const allIssues = state.gradingResults.flatMap(g => g.result.issues || []);
    const issueCounts = {};
    allIssues.forEach(i => { issueCounts[i] = (issueCounts[i] || 0) + 1; });
    const topIssues = Object.entries(issueCounts).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const unreturned = state.gradingResults.filter(g => !g.returned).length;

    return `
      <div class="cai-stat-grid">
        <div class="cai-stat"><div class="n">${state.gradingResults.length}</div><div class="l">Graded</div></div>
        <div class="cai-stat"><div class="n" style="color:#1D9E75">${avg}%</div><div class="l">Class avg</div></div>
        <div class="cai-stat"><div class="n" style="color:#BA7517">${flagged}</div><div class="l">Flagged</div></div>
      </div>
      ${errored > 0 ? `<div class="cai-error" style="font-size:12px">${errored} submission${errored !== 1 ? 's' : ''} could not be auto-graded and need manual review.</div>` : ''}
      <div style="font-size:12px;color:#5f6368">${returned} of ${state.gradingResults.length} returned to students</div>
      <div class="cai-divider"></div>
      ${topIssues.length ? `
        <div>
          <div class="cai-label">Common issues</div>
          <div class="cai-fb" style="display:flex;flex-direction:column;gap:6px">
            ${topIssues.map(([issue, count]) => `
              <div style="display:flex;gap:8px;align-items:flex-start">
                <span style="color:#E24B4A;font-size:14px;line-height:1.2">&#9679;</span>
                <span>${esc(issue)} <span style="color:#9aa0a6">(${count} student${count !== 1 ? 's' : ''})</span></span>
              </div>`).join('')}
          </div>
        </div>` : ''}
      <div class="cai-divider"></div>
      <div class="cai-btn-row" style="flex-wrap:wrap">
        <button class="cai-btn primary" onclick="window.caiReturnAll()" style="flex:1"
          ${unreturned === 0 ? 'disabled' : ''}>
          ${unreturned === 0 ? 'All returned' : `Return ${unreturned} remaining &rarr;`}
        </button>
      </div>
    `;
  }

  // ─── DOM EVENTS ──────────────────────────────────────────────────────────────

  window.caiClose = () => {
    state.sidebarOpen = false;
    document.getElementById('cai-sidebar').classList.remove('open');
  };
  window.caiAuth = launchOAuth;
  window.caiSignOut = signOut;
  window.caiTab = tab => {
    state.activeTab = tab;
    // Auto-load assignments when switching to grader tab
    if (tab === 'grader' && state.currentCourse && !state.assignments.length) {
      loadAssignments().then(render).catch(err => {
        console.error('CAI: Failed to load assignments', err);
        showToast('Failed to load assignments.', 'error');
      });
    }
    render();
  };
  window.caiContentStep = step => { state.contentStep = step; render(); };
  window.caiGraderStep  = step => { state.graderStep  = step; render(); };
  window.caiTopicInput  = val  => { state.topicText = val; };
  window.caiRubricInput = val  => { state.rubricText = val; };
  window.caiStrictness  = val  => { state.strictness = val; render(); };
  window.caiFeedback    = val  => { state.feedbackStyle = val; render(); };
  window.caiBuildField  = (f, v) => {
    if (f === 'title')  state.buildTitle = v;
    if (f === 'desc')   state.buildDesc  = v;
    if (f === 'points') state.buildPoints = v;
    if (f === 'due')    state.buildDue   = v;
  };
  window.caiPickRec = i => { state.pickedRec = i; render(); };
  window.caiToggleType = id => {
    const idx = state.selectedTypes.indexOf(id);
    if (idx > -1) state.selectedTypes.splice(idx, 1);
    else state.selectedTypes.push(id);
    render();
  };
  window.caiShowAllTypes = () => {
    state.showAllTypes = true;
    render();
  };
  window.caiCollapseTypes = () => {
    state.showAllTypes = false;
    render();
  };
  window.caiGenerateRecs = generateContentRecs;
  window.caiBuildRec = () => {
    if (state.pickedRec !== null && state.aiRecs[state.pickedRec]) {
      generateFullContent(state.aiRecs[state.pickedRec]);
    }
  };
  window.caiPostAssignment = async () => {
    if (!state.buildTitle.trim()) {
      showToast('Please enter a title for the assignment.', 'warning');
      return;
    }
    state.isLoading = true;
    state.loadingMsg = 'Posting to Classroom...';
    render();
    try {
      await postAssignment(state.buildTitle, state.buildDesc, state.buildPoints, state.buildDue);
      state.isLoading = false;
      state.contentStep = 'upload';
      state.buildTitle = '';
      state.buildDesc = '';
      state.buildDue = '';
      state.buildPoints = '20';
      state.pickedRec = null;
      state.aiRecs = [];
      showToast('Assignment posted as a Draft! Open Google Classroom to review and publish.', 'success', 6000);
    } catch (e) {
      state.isLoading = false;
      console.error('CAI: postAssignment error', e);
      showToast('Error posting assignment: ' + e.message, 'error', 6000);
    }
    render();
  };
  window.caiSelectAssignment = async id => {
    state.selectedAssignment = state.assignments.find(a => a.id === id) || null;
    render();
  };
  window.caiGradeAll = () => {
    if (state.selectedAssignment) gradeAllSubmissions(state.selectedAssignment);
  };
  window.caiEditGrade = i => {
    const g = state.gradingResults[i];
    if (!g) return;
    const newScore = prompt(`Edit score for student (max ${g.result.maxScore}):`, g.result.score);
    if (newScore !== null) {
      const parsed = parseFloat(newScore);
      if (isNaN(parsed) || parsed < 0) {
        showToast('Please enter a valid non-negative number.', 'warning');
        return;
      }
      if (parsed > g.result.maxScore) {
        showToast(`Score cannot exceed max of ${g.result.maxScore}.`, 'warning');
        return;
      }
      g.result.score = parsed;
      g.edited = true;
      render();
    }
  };
  window.caiReturn = async i => {
    const g = state.gradingResults[i];
    if (!g || g.returned) return;
    try {
      await returnSubmission(
        state.currentCourse.id,
        state.selectedAssignment.id,
        g.sub.id,
        g.result.score
      );
      g.returned = true;
      render();
    } catch (e) {
      console.error('CAI: return error', e);
      showToast('Error returning submission: ' + e.message, 'error');
    }
  };
  window.caiReturnAll = async () => {
    const unreturned = state.gradingResults.filter(g => !g.returned);
    if (unreturned.length === 0) return;

    const confirmed = confirm(`Return grades for ${unreturned.length} submission${unreturned.length !== 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    state.returningAll = true;
    state.returnTotal = unreturned.length;
    state.returnProgress = 0;
    render();

    for (let i = 0; i < state.gradingResults.length; i++) {
      if (!state.gradingResults[i].returned) {
        await window.caiReturn(i);
        state.returnProgress++;
        render();
      }
    }

    state.returningAll = false;
    showToast(`Returned ${state.returnProgress} submission${state.returnProgress !== 1 ? 's' : ''}.`, 'success');
    render();
  };

  /** Handle file upload with size validation. */
  window.caiFileChange = el => {
    const f = el.files[0];
    if (!f) return;

    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      showToast(`File is ${sizeMB.toFixed(1)} MB — max is ${MAX_FILE_SIZE_MB} MB. Please choose a smaller file.`, 'warning', 5000);
      el.value = '';
      return;
    }

    state.uploadedFileName = f.name;
    state.uploadedFileMime = f.type || 'application/pdf';
    const reader = new FileReader();
    reader.onload = e => {
      state.uploadedFileB64 = e.target.result.split(',')[1];
      render();
    };
    reader.onerror = () => {
      showToast('Failed to read file. Please try again.', 'error');
    };
    reader.readAsDataURL(f);
  };

  /** Switch the active course and reload assignments. */
  window.caiSwitchCourse = async id => {
    const course = state.courses.find(c => c.id === id);
    if (!course) return;
    state.currentCourse = course;
    state.assignments = [];
    state.selectedAssignment = null;
    state.gradingResults = [];
    state.graderStep = 'criteria';
    render();
    try {
      await loadAssignments();
    } catch (e) {
      console.error('CAI: Failed to load assignments for course', e);
      showToast('Failed to load assignments for this class.', 'error');
    }
    render();
  };

  // ─── KEYBOARD SHORTCUT ────────────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    // Alt+A toggles the sidebar
    if (e.altKey && e.key === 'a') {
      e.preventDefault();
      state.sidebarOpen = !state.sidebarOpen;
      document.getElementById('cai-sidebar').classList.toggle('open', state.sidebarOpen);
      if (state.sidebarOpen && isTokenValid() && !state.courses.length) {
        loadCourses().then(() => loadAssignments()).then(render).catch(console.error);
      }
    }
  });

  // ─── INIT ────────────────────────────────────────────────────────────────────

  function init() {
    const toggle = document.createElement('button');
    toggle.id = 'cai-toggle';
    toggle.textContent = 'AI';
    toggle.title = 'Open AI Assistant (Alt+A)';
    toggle.onclick = () => {
      state.sidebarOpen = !state.sidebarOpen;
      document.getElementById('cai-sidebar').classList.toggle('open', state.sidebarOpen);
      if (state.sidebarOpen && isTokenValid() && !state.courses.length) {
        loadCourses().then(() => loadAssignments()).then(render).catch(err => {
          console.error('CAI: init load error', err);
          showToast('Failed to load your classes. Please try again.', 'error');
        });
      }
    };

    const sidebar = document.createElement('div');
    sidebar.id = 'cai-sidebar';
    // Inline fallback styles in case GM_addStyle fails to load
    sidebar.style.cssText = 'position:fixed;right:-420px;top:0;width:420px;height:100vh;background:#fff;z-index:99998;border-left:1px solid #e0e0e0;box-shadow:-4px 0 20px rgba(0,0,0,0.1);transition:right 0.25s ease;display:flex;flex-direction:column;font-family:Google Sans,Roboto,sans-serif;font-size:14px;color:#202124;overflow:hidden;';

    document.body.appendChild(toggle);
    document.body.appendChild(sidebar);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
