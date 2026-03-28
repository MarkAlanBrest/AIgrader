// -----------------------------
// Listen for AI key from parent
// -----------------------------
window.addEventListener("message", (event) => {
    // Only accept messages from your Vercel deployment
    if (event.origin !== "https://aigrader-blue.vercel.app") return;
    if (!event.data) return;

    if (event.data.type === "AI_GRADER_INIT") {
        window.AI_KEY = event.data.aiKey;
        console.log("AI key received:", window.AI_KEY);

        const output = document.getElementById("output");
        if (window.AI_KEY && window.AI_KEY.trim() !== "") {
            output.textContent = "AI key loaded successfully.";
        } else {
            output.textContent = "AI key missing.";
        }
    }
});

// -----------------------------
// Test AI button
// -----------------------------
document.getElementById("testAI").addEventListener("click", async () => {
    const output = document.getElementById("output");

    if (!window.AI_KEY || window.AI_KEY.trim() === "") {
        output.textContent = "AI key missing.";
        return;
    }

    output.textContent = "Sending request...";

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
                    { role: "user", content: "Say: AI grader test successful." }
                ]
            })
        });

        const data = await response.json();
        output.textContent = data.choices?.[0]?.message?.content || "No response.";
    } catch (err) {
        output.textContent = "Error: " + err.message;
    }
});
