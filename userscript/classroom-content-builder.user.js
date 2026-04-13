// ==UserScript==
// @name         Google Classroom Content Builder
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  AI-powered content builder for Google Classroom — generate and post announcements, assignments, and materials
// @author       MarkAlanBrest
// @match        https://classroom.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_deleteValue
// @connect      api.anthropic.com
// @connect      accounts.google.com
// @connect      classroom.googleapis.com
// @connect      oauth2.googleapis.com
// @connect      www.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    if (window.__GC_CONTENT_BUILDER__) return;
    window.__GC_CONTENT_BUILDER__ = true;
    if (window.top !== window.self) return;

    // ─────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────
    const APIKEY_KEY    = "AIgrader_APIKey";
    const GCLIENT_KEY   = "gc_google_client_id";
    const GTOKEN_KEY    = "gc_google_token";
    const GTOKEN_EXP    = "gc_google_token_exp";
    const PANEL_WIDTH   = "480px";
    const AI_MODEL      = "claude-sonnet-4-20250514";
    const GC_API        = "https://classroom.googleapis.com/v1";
    const SCOPES        = [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.coursework.students",
        "https://www.googleapis.com/auth/classroom.announcements",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials",
        "https://www.googleapis.com/auth/classroom.topics.readonly"
    ].join(" ");

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────
    let panelInjected = false;
    let panel = null;

    const state = {
        view:        "build",   // "build" | "result" | "setup"
        contentType: "assignment", // "announcement" | "assignment" | "material"
        status:      "",
        statusType:  "idle",

        // Google Auth
        googleClientId: GM_getValue(GCLIENT_KEY, ""),
        googleToken:    GM_getValue(GTOKEN_KEY, ""),
        tokenExpiry:    GM_getValue(GTOKEN_EXP, 0),

        // Courses & Topics
        courses:       [],
        selectedCourse: "",
        topics:         [],
        selectedTopic:  "",

        // Content
        textContent:    "",
        uploadedFile:   "",
        uploadedName:   "",

        // Assignment options
        pageStyle:   "pastel",
        customColor: "#1e3a5f",
        assignmentElements: {
            numberedSteps:    true,
            checklist:        false,
            rubricTable:      false,
            pointValue:       false,
            dueDate:          false,
            linkResources:    false,
        },
        pointValue: "",
        dueDate:    "",

        // Announcement options
        announcementElements: {
            emojiIcons:       true,
            bulletPoints:     true,
            callToAction:     false,
            reminderBox:      false,
        },

        // Material options
        materialElements: {
            emojiIcons:       true,
            numberedSteps:    true,
            sectionHeaders:   true,
            tipBoxes:         false,
            vocabulary:       false,
        },

        // Result
        generatedText:    "",
        generatedTitle:   "",
        postState:        "idle", // "idle" | "posting" | "posted"

        apiKey: GM_getValue(APIKEY_KEY, ""),
    };

    // ─────────────────────────────────────────────
    // DOM HELPERS
    // ─────────────────────────────────────────────
    function el(tag, styles = {}, props = {}) {
        const node = document.createElement(tag);
        Object.assign(node.style, styles);
        Object.assign(node, props);
        return node;
    }

    function div(styles = {}, props = {}) { return el("div", styles, props); }

    function btn(label, bg, color = "#fff", extra = {}) {
        const b = el("button", {
            padding: "9px 14px", borderRadius: "8px", fontWeight: "600",
            cursor: "pointer", fontSize: "13px", border: "none",
            background: bg, color, transition: "opacity 0.15s", ...extra
        }, { textContent: label });
        b.onmouseenter = () => b.style.opacity = "0.85";
        b.onmouseleave = () => b.style.opacity = "1";
        return b;
    }

    function setStatus(text, type = "idle") {
        state.status     = text;
        state.statusType = type;
    }

    function statusColor(type) {
        return { success: "#166534", error: "#b91c1c", loading: "#1d4ed8", idle: "#6b7280" }[type] || "#6b7280";
    }

    function statusBg(type) {
        return { success: "#f0fdf4", error: "#fef2f2", loading: "#eff6ff", idle: "#f9fafb" }[type] || "#f9fafb";
    }

    function toggle(label, checked, onChange, description = "") {
        const row = div({
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid #f1f5f9"
        });

        const left = div({ display: "flex", flexDirection: "column", gap: "2px" });
        left.appendChild(div({ fontSize: "13px", fontWeight: "500", color: "#111827" }, { textContent: label }));
        if (description) {
            left.appendChild(div({ fontSize: "11px", color: "#9ca3af" }, { textContent: description }));
        }

        const switchWrap = div({
            width: "40px", height: "22px", borderRadius: "11px",
            background: checked ? "#2563eb" : "#d1d5db",
            position: "relative", cursor: "pointer",
            transition: "background 0.2s", flexShrink: "0"
        });

        const knob = div({
            position: "absolute", top: "3px",
            left: checked ? "21px" : "3px",
            width: "16px", height: "16px",
            borderRadius: "50%", background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        });

        switchWrap.appendChild(knob);
        switchWrap.onclick = () => {
            const newVal = !checked;
            onChange(newVal);
            switchWrap.style.background = newVal ? "#2563eb" : "#d1d5db";
            knob.style.left = newVal ? "21px" : "3px";
            checked = newVal;
        };

        row.appendChild(left);
        row.appendChild(switchWrap);
        return row;
    }

    function sectionHeader(text) {
        return div({
            fontSize: "11px", fontWeight: "700", color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "14px 0 6px"
        }, { textContent: text });
    }

    function card(styles = {}) {
        return div({
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...styles
        });
    }

    function selectBox(options, value, onChange, extraStyles = {}) {
        const sel = el("select", {
            padding: "8px 10px", borderRadius: "8px",
            border: "1px solid #d1d5db", fontSize: "13px",
            width: "100%", boxSizing: "border-box",
            background: "#fff", cursor: "pointer",
            color: "#111827", ...extraStyles
        });
        options.forEach(opt => {
            const o = el("option", {}, { value: opt.value, textContent: opt.label });
            if (opt.value === value) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = () => onChange(sel.value);
        return sel;
    }

    // ─────────────────────────────────────────────
    // GOOGLE OAUTH 2.0
    // ─────────────────────────────────────────────
    function hasValidToken() {
        return state.googleToken && Date.now() < state.tokenExpiry;
    }

    function startOAuth() {
        if (!state.googleClientId) {
            setStatus("Set your Google Client ID in Settings first.", "error");
            render();
            return;
        }

        const redirectUri = window.location.origin;
        const url = "https://accounts.google.com/o/oauth2/v2/auth?" + [
            "client_id="    + encodeURIComponent(state.googleClientId),
            "redirect_uri=" + encodeURIComponent(redirectUri),
            "response_type=token",
            "scope="        + encodeURIComponent(SCOPES),
            "prompt=consent",
            "include_granted_scopes=true"
        ].join("&");

        const authWindow = window.open(url, "gc_oauth", "width=520,height=680");

        const pollTimer = setInterval(() => {
            try {
                if (!authWindow || authWindow.closed) {
                    clearInterval(pollTimer);
                    return;
                }
                const hash = authWindow.location.hash;
                if (hash && hash.includes("access_token")) {
                    clearInterval(pollTimer);
                    authWindow.close();

                    const params = new URLSearchParams(hash.substring(1));
                    const token  = params.get("access_token");
                    const expiresIn = parseInt(params.get("expires_in") || "3600", 10);

                    state.googleToken = token;
                    state.tokenExpiry = Date.now() + expiresIn * 1000;
                    GM_setValue(GTOKEN_KEY, token);
                    GM_setValue(GTOKEN_EXP, state.tokenExpiry);

                    setStatus("Google account connected!", "success");
                    loadCourses();
                }
            } catch (_) {
                // Cross-origin — keep polling
            }
        }, 500);
    }

    function signOut() {
        state.googleToken = "";
        state.tokenExpiry = 0;
        state.courses = [];
        state.selectedCourse = "";
        state.topics = [];
        state.selectedTopic = "";
        GM_deleteValue(GTOKEN_KEY);
        GM_deleteValue(GTOKEN_EXP);
        setStatus("Signed out.", "idle");
        render();
    }

    // ─────────────────────────────────────────────
    // GOOGLE CLASSROOM API
    // ─────────────────────────────────────────────
    function gcAPI(method, path, body) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url: GC_API + path,
                headers: {
                    "Authorization": "Bearer " + state.googleToken,
                    "Content-Type":  "application/json"
                },
                data: body ? JSON.stringify(body) : undefined,
                timeout: 30000,
                onload(r) {
                    if (r.status === 401) {
                        state.googleToken = "";
                        state.tokenExpiry = 0;
                        GM_deleteValue(GTOKEN_KEY);
                        GM_deleteValue(GTOKEN_EXP);
                        reject(new Error("Token expired — please sign in again."));
                        return;
                    }
                    let data;
                    try { data = JSON.parse(r.responseText); } catch {
                        reject(new Error("Invalid JSON from Classroom API"));
                        return;
                    }
                    if (r.status >= 200 && r.status < 300) resolve(data);
                    else reject(new Error(data?.error?.message || "HTTP " + r.status));
                },
                onerror()   { reject(new Error("Network error")); },
                ontimeout() { reject(new Error("Request timed out")); }
            });
        });
    }

    async function loadCourses() {
        try {
            setStatus("Loading courses...", "loading");
            render();
            const data = await gcAPI("GET", "/courses?courseStates=ACTIVE&teacherId=me&pageSize=50");
            state.courses = (data.courses || []).map(c => ({
                id: c.id,
                name: c.name,
                section: c.section || ""
            }));
            if (state.courses.length > 0 && !state.selectedCourse) {
                state.selectedCourse = state.courses[0].id;
                await loadTopics();
            }
            setStatus(state.courses.length + " course(s) loaded.", "success");
        } catch (err) {
            setStatus("Failed to load courses: " + err.message, "error");
        }
        render();
    }

    async function loadTopics() {
        if (!state.selectedCourse) { state.topics = []; return; }
        try {
            const data = await gcAPI("GET", "/courses/" + state.selectedCourse + "/topics");
            state.topics = (data.topic || []).map(t => ({
                id: t.topicId,
                name: t.name
            }));
        } catch (_) {
            state.topics = [];
        }
    }

    async function postToClassroom() {
        if (!hasValidToken()) {
            setStatus("Not signed in — connect Google first.", "error");
            render();
            return;
        }
        if (!state.selectedCourse) {
            setStatus("Select a course first.", "error");
            render();
            return;
        }

        state.postState = "posting";
        setStatus("Posting to Google Classroom...", "loading");
        render();

        try {
            const courseId = state.selectedCourse;

            if (state.contentType === "announcement") {
                const body = { text: state.generatedText, state: "DRAFT" };
                await gcAPI("POST", "/courses/" + courseId + "/announcements", body);

            } else if (state.contentType === "assignment") {
                const body = {
                    title:          state.generatedTitle || "Untitled Assignment",
                    description:    state.generatedText,
                    workType:       "ASSIGNMENT",
                    state:          "DRAFT",
                    maxPoints:      parseFloat(state.pointValue) || 100,
                };
                if (state.selectedTopic) {
                    body.topicId = state.selectedTopic;
                }
                if (state.dueDate) {
                    const d = new Date(state.dueDate + "T23:59:00");
                    body.dueDate = {
                        year:  d.getFullYear(),
                        month: d.getMonth() + 1,
                        day:   d.getDate()
                    };
                    body.dueTime = { hours: 23, minutes: 59 };
                }
                await gcAPI("POST", "/courses/" + courseId + "/courseWork", body);

            } else if (state.contentType === "material") {
                const body = {
                    title:       state.generatedTitle || "Untitled Material",
                    description: state.generatedText,
                    state:       "DRAFT",
                };
                if (state.selectedTopic) {
                    body.topicId = state.selectedTopic;
                }
                await gcAPI("POST", "/courses/" + courseId + "/courseWorkMaterials", body);
            }

            state.postState = "posted";
            setStatus("Posted as DRAFT to Google Classroom!", "success");
        } catch (err) {
            state.postState = "idle";
            setStatus("Post failed: " + err.message, "error");
        }
        render();
    }

    // ─────────────────────────────────────────────
    // THEME COLORS
    // ─────────────────────────────────────────────
    const THEMES = {
        pastel: {
            name: "Pastel / Soft",
            emoji: "\uD83C\uDF38",
            primary: "#7c3aed", secondary: "#a78bfa",
            bg: "#faf5ff", headerBg: "#ede9fe",
            accent: "#8b5cf6", text: "#1e1b4b",
            cardBg: "#f5f3ff", border: "#c4b5fd"
        },
        bold: {
            name: "Bold / Vibrant",
            emoji: "\u26A1",
            primary: "#dc2626", secondary: "#f97316",
            bg: "#fff7ed", headerBg: "#fee2e2",
            accent: "#ea580c", text: "#1c1917",
            cardBg: "#fff1f2", border: "#fca5a5"
        },
        dark: {
            name: "Dark / Professional",
            emoji: "\uD83C\uDF19",
            primary: "#0ea5e9", secondary: "#38bdf8",
            bg: "#0f172a", headerBg: "#1e293b",
            accent: "#7dd3fc", text: "#f1f5f9",
            cardBg: "#1e293b", border: "#334155"
        },
        earth: {
            name: "Earth Tones",
            emoji: "\uD83C\uDF3F",
            primary: "#854d0e", secondary: "#a16207",
            bg: "#fefce8", headerBg: "#fef9c3",
            accent: "#ca8a04", text: "#1c1917",
            cardBg: "#fffbeb", border: "#fde68a"
        },
        custom: {
            name: "School Colors",
            emoji: "\uD83C\uDFEB",
            primary: "#1e3a5f", secondary: "#2563eb",
            bg: "#f0f7ff", headerBg: "#dbeafe",
            accent: "#3b82f6", text: "#111827",
            cardBg: "#eff6ff", border: "#bfdbfe"
        }
    };

    // ─────────────────────────────────────────────
    // FAB BUTTON
    // ─────────────────────────────────────────────
    function injectFab() {
        const fab = div({
            position: "fixed", bottom: "24px", right: "24px", zIndex: "999990",
            width: "56px", height: "56px", borderRadius: "50%",
            background: "#1a73e8", color: "#fff", border: "none",
            fontSize: "24px", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s, background 0.15s",
            userSelect: "none"
        }, { textContent: "\u270E", title: "Content Builder" });
        fab.onmouseenter = () => { fab.style.transform = "scale(1.08)"; fab.style.background = "#1557b0"; };
        fab.onmouseleave = () => { fab.style.transform = "scale(1)"; fab.style.background = "#1a73e8"; };
        fab.onclick = togglePanel;
        document.body.appendChild(fab);
    }

    // ─────────────────────────────────────────────
    // PANEL LIFECYCLE
    // ─────────────────────────────────────────────
    function togglePanel() {
        if (panelInjected) closePanel();
        else injectPanel();
    }

    function injectPanel() {
        if (panelInjected) return;
        panelInjected = true;

        panel = div({
            position: "fixed", top: "0", right: "0",
            width: PANEL_WIDTH, height: "100vh",
            background: "#f1f5f9", borderLeft: "1px solid #e2e8f0",
            zIndex: "999997", display: "flex", flexDirection: "column",
            boxShadow: "-6px 0 24px rgba(0,0,0,0.10)",
            fontFamily: "Inter, system-ui, Arial",
            boxSizing: "border-box", overflow: "hidden"
        });

        document.body.appendChild(panel);

        // Check if setup needed
        if (!state.apiKey || !state.googleClientId) {
            state.view = "setup";
        }

        // Auto-load courses if we have a token
        if (hasValidToken() && state.courses.length === 0) {
            loadCourses();
        }

        render();
    }

    function closePanel() {
        panel?.remove();
        panel = null;
        panelInjected = false;
    }

    // ─────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────
    function render() {
        if (!panel) return;
        try {
            panel.innerHTML = "";
            panel.appendChild(buildTopBar());

            const content = div({ flex: "1", overflowY: "auto", display: "flex", flexDirection: "column" });

            if      (state.view === "setup")  content.appendChild(buildSetupView());
            else if (state.view === "build")  content.appendChild(buildBuildView());
            else if (state.view === "result") content.appendChild(buildResultView());

            panel.appendChild(content);

            // Status bar
            if (state.status) {
                const bar = div({
                    padding: "10px 14px", fontSize: "13px", fontWeight: "500",
                    borderTop: "1px solid " + (state.statusType === "error" ? "#fca5a5" : state.statusType === "success" ? "#86efac" : "#bfdbfe"),
                    background: statusBg(state.statusType),
                    color: statusColor(state.statusType),
                    flexShrink: "0", textAlign: "center"
                }, { textContent: state.status });
                panel.appendChild(bar);
            }
        } catch (err) {
            panel.innerHTML = "";
            const errBox = div({
                padding: "20px", margin: "20px", background: "#fef2f2",
                border: "1px solid #fca5a5", borderRadius: "8px",
                color: "#b91c1c", fontSize: "13px", lineHeight: "1.5"
            }, { textContent: "Render error: " + err.message });
            panel.appendChild(errBox);
        }
    }

    // ─────────────────────────────────────────────
    // TOP BAR
    // ─────────────────────────────────────────────
    function buildTopBar() {
        const bar = div({
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px", height: "52px",
            background: "#1a4731", color: "#fff", flexShrink: "0"
        });

        const left = div({ display: "flex", alignItems: "center", gap: "10px" });

        const logo = div({
            width: "30px", height: "30px", borderRadius: "8px",
            background: "#16a085", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "16px"
        }, { textContent: "\u270E" });

        const title = div({ fontWeight: "700", fontSize: "15px" }, {
            textContent: state.view === "setup"  ? "Settings"
                       : state.view === "result" ? "Generated Content"
                       : "Content Builder"
        });

        left.appendChild(logo);
        left.appendChild(title);
        bar.appendChild(left);

        const right = div({ display: "flex", alignItems: "center", gap: "8px" });

        if (state.view !== "setup") {
            right.appendChild(navTab("Build",  state.view === "build",  () => { state.view = "build";  render(); }));
            right.appendChild(navTab("\u2699", false,                   () => { state.view = "setup";  render(); }));
        }

        const closeX = el("button", {
            background: "none", border: "none", color: "#94a3b8",
            fontSize: "20px", cursor: "pointer", padding: "4px 6px", lineHeight: "1"
        }, { textContent: "\u2715" });
        closeX.onclick = closePanel;
        right.appendChild(closeX);
        bar.appendChild(right);

        return bar;
    }

    function navTab(label, active, onClick) {
        const t = el("button", {
            padding: "5px 10px", borderRadius: "6px", border: "none",
            cursor: "pointer", fontSize: "12px", fontWeight: "600",
            background: active ? "#16a085" : "rgba(255,255,255,0.1)",
            color: active ? "#fff" : "#cbd5e1"
        }, { textContent: label });
        t.onclick = onClick;
        return t;
    }

    // ─────────────────────────────────────────────
    // SETUP VIEW
    // ─────────────────────────────────────────────
    function buildSetupView() {
        const wrap = div({ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" });

        // ── ANTHROPIC KEY ──
        const claudeCard = card();
        claudeCard.appendChild(sectionHeader("Anthropic API Key"));
        claudeCard.appendChild(div({
            fontSize: "12px", color: "#6b7280", marginBottom: "8px", lineHeight: "1.5"
        }, { textContent: "Shared with AI Grader. Powers content generation via Claude." }));

        const keyInput = el("input", {
            padding: "10px 12px", borderRadius: "8px",
            border: "1px solid #d1d5db", fontSize: "13px",
            width: "100%", boxSizing: "border-box",
            fontFamily: "monospace", background: "#fff"
        }, { type: "password", placeholder: "sk-ant-api03-...", value: state.apiKey || "" });

        claudeCard.appendChild(keyInput);
        wrap.appendChild(claudeCard);

        // ── GOOGLE CLIENT ID ──
        const googleCard = card();
        googleCard.appendChild(sectionHeader("Google Cloud Client ID"));
        googleCard.appendChild(div({
            fontSize: "12px", color: "#6b7280", marginBottom: "8px", lineHeight: "1.5"
        }, { textContent: "Create an OAuth 2.0 Client ID at console.cloud.google.com. Enable the Google Classroom API and add classroom.google.com as an authorized JavaScript origin." }));

        const clientInput = el("input", {
            padding: "10px 12px", borderRadius: "8px",
            border: "1px solid #d1d5db", fontSize: "13px",
            width: "100%", boxSizing: "border-box",
            fontFamily: "monospace", background: "#fff"
        }, { type: "text", placeholder: "123456789-abc.apps.googleusercontent.com", value: state.googleClientId || "" });

        googleCard.appendChild(clientInput);
        wrap.appendChild(googleCard);

        // ── GOOGLE AUTH STATUS ──
        const authCard = card();
        authCard.appendChild(sectionHeader("Google Account"));

        if (hasValidToken()) {
            const minsLeft = Math.round((state.tokenExpiry - Date.now()) / 60000);
            authCard.appendChild(div({
                padding: "10px 12px", borderRadius: "8px",
                background: "#f0fdf4", border: "1px solid #86efac",
                fontSize: "13px", color: "#166534", marginBottom: "8px"
            }, { textContent: "Connected (" + minsLeft + " min remaining)" }));

            const signOutBtn = btn("Sign Out", "#ef4444", "#fff", { width: "100%", boxSizing: "border-box" });
            signOutBtn.onclick = signOut;
            authCard.appendChild(signOutBtn);
        } else {
            authCard.appendChild(div({
                padding: "10px 12px", borderRadius: "8px",
                background: "#fef2f2", border: "1px solid #fca5a5",
                fontSize: "13px", color: "#b91c1c", marginBottom: "8px"
            }, { textContent: "Not connected" }));

            const connectBtn = btn("Connect Google Account", "#1a73e8", "#fff", { width: "100%", boxSizing: "border-box" });
            connectBtn.onclick = () => {
                state.googleClientId = clientInput.value.trim();
                if (state.googleClientId) GM_setValue(GCLIENT_KEY, state.googleClientId);
                startOAuth();
            };
            authCard.appendChild(connectBtn);
        }

        wrap.appendChild(authCard);

        // ── SAVE BUTTON ──
        const saveBtn = btn("Save & Start Building", "#16a085", "#fff", {
            width: "100%", boxSizing: "border-box", padding: "14px", fontSize: "15px",
            boxShadow: "0 4px 14px rgba(22,160,133,0.35)"
        });
        saveBtn.onclick = () => {
            const key = keyInput.value.trim();
            const clientId = clientInput.value.trim();

            if (key && !key.startsWith("sk-ant-")) {
                setStatus("Invalid API key -- should start with sk-ant-", "error");
                render();
                return;
            }

            if (key) {
                state.apiKey = key;
                GM_setValue(APIKEY_KEY, key);
            }
            if (clientId) {
                state.googleClientId = clientId;
                GM_setValue(GCLIENT_KEY, clientId);
            }

            if (!state.apiKey) {
                setStatus("Anthropic API key is required.", "error");
                render();
                return;
            }
            if (!state.googleClientId) {
                setStatus("Google Client ID is required.", "error");
                render();
                return;
            }

            state.view = "build";
            setStatus("Settings saved!", "success");
            render();
        };
        wrap.appendChild(saveBtn);

        return wrap;
    }

    // ─────────────────────────────────────────────
    // BUILD VIEW
    // ─────────────────────────────────────────────
    function buildBuildView() {
        const wrap = div({ padding: "14px", display: "flex", flexDirection: "column", gap: "0" });

        // ── GOOGLE CONNECTION BAR ──
        if (!hasValidToken()) {
            const authBar = div({
                padding: "10px 14px", borderRadius: "10px",
                background: "#fffbeb", border: "1px solid #fde68a",
                marginBottom: "10px", display: "flex",
                alignItems: "center", justifyContent: "space-between"
            });
            authBar.appendChild(div({ fontSize: "12px", color: "#92400e" }, { textContent: "Google not connected" }));
            const connectBtn = btn("Connect", "#1a73e8", "#fff", { fontSize: "11px", padding: "6px 12px" });
            connectBtn.onclick = startOAuth;
            authBar.appendChild(connectBtn);
            wrap.appendChild(authBar);
        }

        // ── COURSE SELECTOR ──
        if (hasValidToken()) {
            const courseCard = card({ marginBottom: "10px" });
            courseCard.appendChild(sectionHeader("Course"));

            if (state.courses.length === 0) {
                const loadBtn = btn("Load Courses", "#1a73e8", "#fff", { width: "100%", boxSizing: "border-box" });
                loadBtn.onclick = loadCourses;
                courseCard.appendChild(loadBtn);
            } else {
                const courseOpts = state.courses.map(c => ({
                    value: c.id,
                    label: c.name + (c.section ? " - " + c.section : "")
                }));
                courseCard.appendChild(selectBox(courseOpts, state.selectedCourse, async (val) => {
                    state.selectedCourse = val;
                    state.selectedTopic = "";
                    await loadTopics();
                    render();
                }));

                // Topic selector (if topics exist)
                if (state.topics.length > 0) {
                    courseCard.appendChild(div({ marginTop: "8px" }));
                    courseCard.appendChild(sectionHeader("Topic (optional)"));
                    const topicOpts = [{ value: "", label: "-- No Topic --" }].concat(
                        state.topics.map(t => ({ value: t.id, label: t.name }))
                    );
                    courseCard.appendChild(selectBox(topicOpts, state.selectedTopic, val => {
                        state.selectedTopic = val;
                    }));
                }
            }

            wrap.appendChild(courseCard);
        }

        // ── TYPE SELECTOR ──
        const typeCard = card({ marginBottom: "10px" });
        typeCard.appendChild(sectionHeader("What are you creating?"));

        const typeRow = div({ display: "flex", gap: "6px" });

        const TYPES = [
            { key: "announcement", icon: "\uD83D\uDCE2", label: "Announce" },
            { key: "assignment",   icon: "\uD83D\uDCDD", label: "Assignment" },
            { key: "material",     icon: "\uD83D\uDCD6", label: "Material" },
        ];

        TYPES.forEach(type => {
            const active = state.contentType === type.key;
            const typeBtn = el("button", {
                flex: "1", padding: "10px 6px", borderRadius: "10px",
                border: "2px solid " + (active ? "#16a085" : "#e5e7eb"),
                background: active ? "#f0fdfa" : "#f9fafb",
                cursor: "pointer", fontWeight: "600", fontSize: "12px",
                color: active ? "#16a085" : "#6b7280",
                transition: "all 0.15s", textAlign: "center"
            });
            typeBtn.innerHTML = '<div style="font-size:18px;margin-bottom:2px">' + type.icon + '</div>' + type.label;
            typeBtn.onclick = () => { state.contentType = type.key; render(); };
            typeRow.appendChild(typeBtn);
        });

        typeCard.appendChild(typeRow);
        wrap.appendChild(typeCard);

        // ── STYLE OPTIONS ──
        const styleCard = card({ marginBottom: "10px" });
        styleCard.appendChild(sectionHeader("Content Style"));

        const themeGrid = div({
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "6px", marginBottom: "12px"
        });

        Object.entries(THEMES).forEach(([key, theme]) => {
            const active = state.pageStyle === key;
            const themeBtn = el("button", {
                padding: "8px 10px", borderRadius: "8px",
                border: "2px solid " + (active ? "#16a085" : "#e5e7eb"),
                background: active ? "#f0fdfa" : "#f9fafb",
                cursor: "pointer", fontSize: "12px", fontWeight: "500",
                color: active ? "#16a085" : "#374151",
                textAlign: "left", transition: "all 0.15s"
            }, { textContent: theme.emoji + " " + theme.name });
            themeBtn.onclick = () => { state.pageStyle = key; render(); };
            themeGrid.appendChild(themeBtn);
        });

        styleCard.appendChild(themeGrid);

        if (state.pageStyle === "custom") {
            const colorRow = div({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" });
            colorRow.appendChild(div({ fontSize: "13px", color: "#374151" }, { textContent: "Primary color:" }));
            const colorInput = el("input", { width: "50px", height: "30px", borderRadius: "6px", border: "1px solid #d1d5db", cursor: "pointer" });
            colorInput.type = "color";
            colorInput.value = state.customColor;
            colorInput.oninput = () => { state.customColor = colorInput.value; };
            colorRow.appendChild(colorInput);
            styleCard.appendChild(colorRow);
        }

        wrap.appendChild(styleCard);

        // ── TYPE-SPECIFIC OPTIONS ──
        if (state.contentType === "assignment") {
            const optCard = card({ marginBottom: "10px" });
            optCard.appendChild(sectionHeader("Assignment Elements"));

            const elementLabels = {
                numberedSteps: ["Numbered Steps",       "Step-by-step directions"],
                checklist:     ["Student Checklist",     "Checkbox list for students"],
                rubricTable:   ["Rubric Table",          "Grading criteria table"],
                pointValue:    ["Point Value",           "Show total points"],
                dueDate:       ["Due Date",              "Show due date prominently"],
                linkResources: ["Resource Links",        "Suggest helpful resources"],
            };

            Object.entries(elementLabels).forEach(([key, [label, desc]]) => {
                optCard.appendChild(toggle(
                    label, state.assignmentElements[key],
                    val => { state.assignmentElements[key] = val; },
                    desc
                ));
            });

            if (state.assignmentElements.pointValue) {
                const ptRow = div({ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" });
                ptRow.appendChild(div({ fontSize: "13px", color: "#374151", whiteSpace: "nowrap" }, { textContent: "Points:" }));
                const ptInput = el("input", {
                    flex: "1", padding: "7px 10px", borderRadius: "8px",
                    border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box"
                }, { type: "number", placeholder: "100", value: state.pointValue });
                ptInput.oninput = () => { state.pointValue = ptInput.value; };
                ptRow.appendChild(ptInput);
                optCard.appendChild(ptRow);
            }

            if (state.assignmentElements.dueDate) {
                const dateRow = div({ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" });
                dateRow.appendChild(div({ fontSize: "13px", color: "#374151", whiteSpace: "nowrap" }, { textContent: "Due Date:" }));
                const dateInput = el("input", {
                    flex: "1", padding: "7px 10px", borderRadius: "8px",
                    border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box"
                }, { type: "date", value: state.dueDate });
                dateInput.oninput = () => { state.dueDate = dateInput.value; };
                dateRow.appendChild(dateInput);
                optCard.appendChild(dateRow);
            }

            wrap.appendChild(optCard);

        } else if (state.contentType === "announcement") {
            const optCard = card({ marginBottom: "10px" });
            optCard.appendChild(sectionHeader("Announcement Elements"));

            const elementLabels = {
                emojiIcons:    ["Emoji Icons",        "Add relevant emojis"],
                bulletPoints:  ["Bullet Points",      "Organize info as bullet points"],
                callToAction:  ["Call to Action",     "Clear instruction at the end"],
                reminderBox:   ["Reminder / Deadline","Highlight upcoming dates"],
            };

            Object.entries(elementLabels).forEach(([key, [label, desc]]) => {
                optCard.appendChild(toggle(
                    label, state.announcementElements[key],
                    val => { state.announcementElements[key] = val; },
                    desc
                ));
            });

            wrap.appendChild(optCard);

        } else if (state.contentType === "material") {
            const optCard = card({ marginBottom: "10px" });
            optCard.appendChild(sectionHeader("Material Elements"));

            const elementLabels = {
                emojiIcons:       ["Emoji Icons",       "Add relevant emojis"],
                numberedSteps:    ["Numbered Steps",    "Step-by-step instructions"],
                sectionHeaders:   ["Section Headers",   "Clear section headings"],
                tipBoxes:         ["Tips / Key Points", "Highlight important info"],
                vocabulary:       ["Vocabulary List",   "Include key terms"],
            };

            Object.entries(elementLabels).forEach(([key, [label, desc]]) => {
                optCard.appendChild(toggle(
                    label, state.materialElements[key],
                    val => { state.materialElements[key] = val; },
                    desc
                ));
            });

            wrap.appendChild(optCard);
        }

        // ── CONTENT INPUT ──
        const contentCard = card({ marginBottom: "10px" });
        contentCard.appendChild(sectionHeader("Content"));

        // File upload
        const uploadRow = div({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" });

        const fileChip = div({
            flex: "1", padding: "8px 12px", borderRadius: "8px",
            border: "1px dashed #94a3b8",
            background: state.uploadedName ? "#eff6ff" : "#f9fafb",
            fontSize: "12px",
            color: state.uploadedName ? "#1d4ed8" : "#6b7280",
            textAlign: "center", boxSizing: "border-box",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }, { textContent: state.uploadedName ? "\uD83D\uDCCE " + state.uploadedName : "No file selected" });

        uploadRow.appendChild(fileChip);

        const uploadBtn = btn("\uD83D\uDCC1 Upload", "#64748b", "#fff", { padding: "8px 12px", fontSize: "12px", flexShrink: "0" });
        uploadBtn.onclick = () => {
            const existing = document.getElementById("gcb-file-input");
            if (existing) existing.remove();

            const fileInput = document.createElement("input");
            fileInput.id = "gcb-file-input";
            fileInput.type = "file";
            fileInput.accept = ".txt,.pdf,.doc,.docx,.csv,.md";
            fileInput.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";

            fileInput.onchange = () => {
                const file = fileInput.files[0];
                fileInput.remove();
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                    setStatus("File too large (max 10 MB).", "error");
                    render();
                    return;
                }

                const reader = new FileReader();
                reader.onload = e => {
                    state.uploadedFile = e.target.result;
                    state.uploadedName = file.name;
                    setStatus("File loaded: " + file.name, "success");
                    render();
                };
                reader.onerror = () => { setStatus("Failed to read file.", "error"); render(); };
                reader.readAsText(file);
            };

            document.body.appendChild(fileInput);
            fileInput.click();
        };
        uploadRow.appendChild(uploadBtn);

        if (state.uploadedName) {
            const clearBtn = btn("\u2715", "#ef4444", "#fff", { padding: "6px 10px", fontSize: "12px" });
            clearBtn.onclick = () => { state.uploadedFile = ""; state.uploadedName = ""; render(); };
            uploadRow.appendChild(clearBtn);
        }

        contentCard.appendChild(uploadRow);

        // Text area
        contentCard.appendChild(div({
            fontSize: "12px", color: "#6b7280", marginBottom: "6px"
        }, { textContent: "Paste content, notes, or describe what you want:" }));

        const textArea = el("textarea", {
            width: "100%", minHeight: "120px", resize: "vertical",
            padding: "10px", borderRadius: "8px",
            border: "1px solid #d1d5db", fontSize: "13px",
            boxSizing: "border-box", fontFamily: "Inter, system-ui, Arial",
            lineHeight: "1.5", background: "#f9fafb"
        }, {
            placeholder: "Example: Create a lesson on the American Revolution. Cover key battles, important figures, and the Declaration of Independence...",
            value: state.textContent
        });

        textArea.oninput = () => { state.textContent = textArea.value; };
        contentCard.appendChild(textArea);
        wrap.appendChild(contentCard);

        // ── GENERATE BUTTON ──
        const typeLabel = { announcement: "Announcement", assignment: "Assignment", material: "Material" }[state.contentType];
        const generateBtn = btn(
            "\u2726 Generate " + typeLabel,
            "#16a085", "#fff", {
                width: "100%", boxSizing: "border-box",
                padding: "14px", fontSize: "15px",
                boxShadow: "0 4px 14px rgba(22,160,133,0.35)",
                marginBottom: "6px"
            }
        );
        generateBtn.onclick = handleGenerate;
        wrap.appendChild(generateBtn);

        // Last result button
        if (state.generatedText) {
            const viewResultBtn = btn("View Last Result \u2192", "#e2e8f0", "#374151", {
                width: "100%", boxSizing: "border-box", fontSize: "13px"
            });
            viewResultBtn.onclick = () => { state.view = "result"; render(); };
            wrap.appendChild(viewResultBtn);
        }

        return wrap;
    }

    // ─────────────────────────────────────────────
    // GENERATE HANDLER
    // ─────────────────────────────────────────────
    function handleGenerate() {
        if (!state.apiKey) {
            setStatus("No API key -- go to Settings first.", "error");
            render();
            return;
        }

        if (!state.textContent.trim() && !state.uploadedFile) {
            setStatus("Add some content or a file first.", "error");
            render();
            return;
        }

        setStatus("Claude is building your content...", "loading");
        state.postState = "idle";
        render();

        const theme = state.pageStyle === "custom"
            ? { ...THEMES.custom, primary: state.customColor, secondary: state.customColor }
            : THEMES[state.pageStyle] || THEMES.pastel;

        const prompt = buildPrompt(theme);

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.anthropic.com/v1/messages",
            headers: {
                "Content-Type":      "application/json",
                "x-api-key":         state.apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            data: JSON.stringify({
                model:      AI_MODEL,
                max_tokens: 4096,
                messages:   [{ role: "user", content: prompt }]
            }),
            timeout: 90000,
            onload(response) {
                let data;
                try { data = JSON.parse(response.responseText); } catch {
                    setStatus("Invalid response from Claude.", "error");
                    render();
                    return;
                }

                if (response.status !== 200) {
                    setStatus("Claude error: " + (data?.error?.message || "HTTP " + response.status), "error");
                    render();
                    return;
                }

                let raw = data?.content?.[0]?.text || "";

                // Parse title and body from response
                const titleMatch = raw.match(/^TITLE:\s*(.+?)(?:\n|$)/m);
                if (titleMatch) {
                    state.generatedTitle = titleMatch[1].trim();
                    raw = raw.replace(titleMatch[0], "").trim();
                } else {
                    state.generatedTitle = "Untitled";
                }

                // Remove any markdown fences
                raw = raw.replace(/```[a-z]*/gi, "").replace(/```/g, "").trim();

                state.generatedText = raw;
                state.view          = "result";
                setStatus("Content generated!", "success");
                render();
            },
            onerror()   { setStatus("Network error -- check your connection.", "error"); render(); },
            ontimeout() { setStatus("Timed out -- try with less content.", "error"); render(); }
        });
    }

    // ─────────────────────────────────────────────
    // PROMPT BUILDER
    // ─────────────────────────────────────────────
    function buildPrompt(theme) {
        const type = state.contentType;

        let prompt = "";
        prompt += "You are an expert teacher's assistant for Google Classroom. ";
        prompt += "Generate professional, well-structured content for a Google Classroom " + type + ".\n\n";

        prompt += "IMPORTANT: Start your response with a line like:\n";
        prompt += "TITLE: <a clear, engaging title for this content>\n\n";
        prompt += "Then provide the body content below it.\n\n";

        prompt += "=============================\n";
        prompt += "FORMATTING GUIDELINES\n";
        prompt += "=============================\n";
        prompt += "- Google Classroom descriptions are PLAIN TEXT (not HTML)\n";
        prompt += "- Use Unicode formatting: bold via asterisks, clean line breaks, numbered lists\n";
        prompt += "- Use clear section headers with line separators (e.g. ========)\n";
        prompt += "- Use bullet points and numbered lists for clarity\n";
        prompt += "- Keep formatting clean and professional\n";
        prompt += "- Make it visually organized and easy to scan\n\n";

        prompt += "=============================\n";
        prompt += "CONTENT TYPE: " + type.toUpperCase() + "\n";
        prompt += "=============================\n";
        prompt += "Tone/Style: " + (THEMES[state.pageStyle]?.name || "Professional") + "\n\n";

        prompt += "=============================\n";
        prompt += "ELEMENTS TO INCLUDE\n";
        prompt += "=============================\n";

        if (type === "announcement") {
            const els = state.announcementElements;
            if (els.emojiIcons)    prompt += "- Add relevant emojis throughout to make it engaging\n";
            if (els.bulletPoints)  prompt += "- Organize key information as clear bullet points\n";
            if (els.callToAction)  prompt += "- End with a clear call-to-action or next step for students\n";
            if (els.reminderBox)   prompt += "- Include a reminder section with any upcoming deadlines\n";
        } else if (type === "assignment") {
            const els = state.assignmentElements;
            if (els.numberedSteps)  prompt += "- Format all directions as clearly numbered steps\n";
            if (els.checklist)      prompt += "- Include a student checklist at the end\n";
            if (els.rubricTable)    prompt += "- Include a grading rubric as a formatted text table\n";
            if (els.linkResources)  prompt += "- Suggest helpful resources students can reference\n";
            if (els.pointValue && state.pointValue) prompt += "- Show total points: " + state.pointValue + " points\n";
            if (els.dueDate && state.dueDate)       prompt += "- Show due date prominently: " + state.dueDate + "\n";
        } else if (type === "material") {
            const els = state.materialElements;
            if (els.emojiIcons)      prompt += "- Add relevant emojis to section headers\n";
            if (els.numberedSteps)   prompt += "- Format instructions as numbered steps\n";
            if (els.sectionHeaders)  prompt += "- Use clear section headers with separators\n";
            if (els.tipBoxes)        prompt += "- Include tip/key point sections marked with a star or lightbulb emoji\n";
            if (els.vocabulary)      prompt += "- Include a vocabulary/key terms section\n";
        }

        prompt += "\n=============================\n";
        prompt += "CONTENT TO USE\n";
        prompt += "=============================\n";

        if (state.textContent.trim()) {
            prompt += "Teacher's Input:\n" + state.textContent + "\n\n";
        }

        if (state.uploadedFile) {
            prompt += "Uploaded File (" + state.uploadedName + "):\n" + state.uploadedFile + "\n\n";
        }

        prompt += "=============================\n";
        prompt += "REQUIREMENTS\n";
        prompt += "=============================\n";
        prompt += "- Start with TITLE: followed by a clear, engaging title\n";
        prompt += "- Then write the body content\n";
        prompt += "- Use plain text only (no HTML, no markdown code blocks)\n";
        prompt += "- Make it professional and engaging for students\n";
        prompt += "- Keep it concise but thorough\n";
        prompt += "- Use proper spacing and formatting for readability\n";

        return prompt;
    }

    // ─────────────────────────────────────────────
    // RESULT VIEW
    // ─────────────────────────────────────────────
    function buildResultView() {
        const wrap = div({ display: "flex", flexDirection: "column", height: "100%" });

        // ── TITLE ──
        const titleSection = div({
            padding: "14px", borderBottom: "1px solid #e5e7eb",
            background: "#fff", flexShrink: "0"
        });
        titleSection.appendChild(div({
            fontSize: "11px", fontWeight: "700", color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px"
        }, { textContent: "Title" }));

        const titleInput = el("input", {
            width: "100%", boxSizing: "border-box",
            padding: "10px 12px", borderRadius: "8px",
            border: "1px solid #d1d5db", fontSize: "14px",
            fontWeight: "600", background: "#f9fafb"
        }, { type: "text", value: state.generatedTitle });
        titleInput.oninput = () => { state.generatedTitle = titleInput.value; };
        titleSection.appendChild(titleInput);
        wrap.appendChild(titleSection);

        // ── PREVIEW / EDIT ──
        const tabRow = div({
            display: "flex", borderBottom: "1px solid #e5e7eb",
            background: "#fff", flexShrink: "0"
        });

        let editing = false;

        const previewTab = el("button", {
            flex: "1", padding: "10px", border: "none", borderBottom: "2px solid #16a085",
            background: "#fff", cursor: "pointer", fontSize: "13px",
            fontWeight: "700", color: "#16a085"
        }, { textContent: "Preview" });

        const editTab = el("button", {
            flex: "1", padding: "10px", border: "none", borderBottom: "2px solid transparent",
            background: "#f9fafb", cursor: "pointer", fontSize: "13px",
            fontWeight: "500", color: "#6b7280"
        }, { textContent: "Edit" });

        const previewBox = div({
            flex: "1", padding: "16px", overflowY: "auto",
            fontSize: "13px", lineHeight: "1.7", color: "#1f2937",
            whiteSpace: "pre-wrap", fontFamily: "Inter, system-ui, Arial",
            background: "#fff"
        }, { textContent: state.generatedText || "No content generated." });

        const editBox = el("textarea", {
            flex: "1", padding: "14px", fontFamily: "Consolas, monospace",
            fontSize: "12px", border: "none", resize: "none",
            background: "#1e293b", color: "#e2e8f0",
            lineHeight: "1.6", display: "none"
        }, { value: state.generatedText });
        editBox.oninput = () => { state.generatedText = editBox.value; };

        previewTab.onclick = () => {
            editing = false;
            previewBox.style.display = "block";
            previewBox.textContent = state.generatedText;
            editBox.style.display = "none";
            previewTab.style.borderBottomColor = "#16a085";
            previewTab.style.color = "#16a085";
            previewTab.style.fontWeight = "700";
            previewTab.style.background = "#fff";
            editTab.style.borderBottomColor = "transparent";
            editTab.style.color = "#6b7280";
            editTab.style.fontWeight = "500";
            editTab.style.background = "#f9fafb";
        };

        editTab.onclick = () => {
            editing = true;
            previewBox.style.display = "none";
            editBox.style.display = "block";
            editBox.value = state.generatedText;
            editTab.style.borderBottomColor = "#16a085";
            editTab.style.color = "#16a085";
            editTab.style.fontWeight = "700";
            editTab.style.background = "#fff";
            previewTab.style.borderBottomColor = "transparent";
            previewTab.style.color = "#6b7280";
            previewTab.style.fontWeight = "500";
            previewTab.style.background = "#f9fafb";
        };

        tabRow.appendChild(previewTab);
        tabRow.appendChild(editTab);
        wrap.appendChild(tabRow);

        const contentArea = div({ flex: "1", display: "flex", flexDirection: "column", overflow: "hidden" });
        contentArea.appendChild(previewBox);
        contentArea.appendChild(editBox);
        wrap.appendChild(contentArea);

        // ── ACTIONS ──
        const actions = div({
            padding: "12px 14px", borderTop: "1px solid #e5e7eb",
            background: "#f8fafc", display: "flex",
            flexDirection: "column", gap: "8px", flexShrink: "0"
        });

        // Post to Classroom button
        if (hasValidToken() && state.selectedCourse) {
            const postBtn = btn(
                state.postState === "posting" ? "Posting..." :
                state.postState === "posted"  ? "Posted as Draft!" :
                "\uD83D\uDE80 Post Draft to Classroom",
                state.postState === "posted" ? "#166534" : "#1a73e8", "#fff", {
                    width: "100%", boxSizing: "border-box", padding: "12px",
                    opacity: state.postState === "posting" ? "0.7" : "1"
                }
            );
            if (state.postState !== "posting") {
                postBtn.onclick = postToClassroom;
            }
            actions.appendChild(postBtn);
        }

        // Copy text button
        const copyBtn = btn("\uD83D\uDCCB Copy Text", "#16a085", "#fff", {
            width: "100%", boxSizing: "border-box", padding: "12px"
        });
        copyBtn.onclick = () => {
            const fullText = (state.generatedTitle ? state.generatedTitle + "\n\n" : "") + state.generatedText;
            navigator.clipboard.writeText(fullText).then(() => {
                setStatus("Copied! Paste into Google Classroom.", "success");
                render();
            });
        };
        actions.appendChild(copyBtn);

        // How-to help
        if (!hasValidToken() || !state.selectedCourse) {
            const howTo = div({
                padding: "10px 12px", borderRadius: "8px",
                background: "#fffbeb", border: "1px solid #fde68a",
                fontSize: "12px", color: "#92400e", lineHeight: "1.6"
            });
            howTo.innerHTML = "<strong>How to use:</strong><br>" +
                "1. Copy the text above<br>" +
                "2. Go to your Google Classroom course<br>" +
                "3. Create a new assignment/announcement/material<br>" +
                "4. Paste the content into the description<br>" +
                "5. Edit title and details as needed";
            actions.appendChild(howTo);
        }

        // Back button
        const rebuildBtn = btn("\u2190 Back to Builder", "#e2e8f0", "#374151", {
            width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "9px"
        });
        rebuildBtn.onclick = () => { state.view = "build"; state.postState = "idle"; setStatus("", "idle"); render(); };
        actions.appendChild(rebuildBtn);

        wrap.appendChild(actions);
        return wrap;
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────
    injectFab();

})();
