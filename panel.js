// Store AI key once received from Tampermonkey
window.AI_KEY = null;

// Listen for messages from the Tampermonkey loader or watcher.js
window.addEventListener("message", (event) => {
    if (!event.data) return;

    // Receive AI key from loader
    if (event.data.type === "AI_GRADER_INIT") {
        window.AI_KEY = event.data.aiKey;
        console.log("AI key received:", window.AI_KEY);
        return;
    } 

    // Student changed event from watcher.js
    if (event.data.type === "STUDENT_CHANGED") {
        const id = event.data.studentId;
        console.log("Student changed:", id);

        // TODO: fetch submission + run AI
        document.getElementById("output").textContent =
            "Student changed: " + id;
    }
});

// --- AI CALL FUNCTION ---
async function runAI(prompt) {
    if (!window.AI_KEY) {
        console.error("AI key not loaded yet.");
        return "AI key missing.";
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${window.AI_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are an expert grader." },
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No response.";
    } catch (err) {
        console.error(err);
        return "Error calling AI.";
    }
}

// --- TEST BUTTON ---
document.getElementById("testAI").addEventListener("click", async () => {
    document.getElementById("output").textContent = "Running AI…";

    const result = await runAI("Say hello from inside SpeedGrader.");
    document.getElementById("output").textContent = result;
});
