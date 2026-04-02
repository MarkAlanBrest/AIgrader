import { NextRequest, NextResponse } from "next/server";

function buildHTMLFromJSON(data: any) {
  if (!data || !data.sections) return "<div>No content</div>";

  return `
    <div style="padding:20px;font-family:sans-serif;">
      <h1 style="font-size:28px;margin-bottom:20px;">
        ${data.title || "Generated Page"}
      </h1>

      ${data.sections.map((section: any) => {

        if (section.type === "heading") {
          return `<h2 style="margin-top:20px;">${section.text}</h2>`;
        }

        if (section.type === "text") {
          return `<p>${section.content}</p>`;
        }

        if (section.type === "list") {
          return `<ul>${section.items.map((i: string) => `<li>${i}</li>`).join("")}</ul>`;
        }

        if (section.type === "divider") {
          return `<hr style="margin:20px 0;" />`;
        }

        // 🔥 SPLIT LAYOUT
        if (section.type === "split") {
          return `
            <div style="display:flex;gap:20px;margin:20px 0;">
              <div style="flex:1;">${section.left}</div>
              <div style="flex:1;">${section.right}</div>
            </div>
          `;
        }

        // 🔥 GRID / PANELS
        if (section.type === "grid") {
          const cols = section.columns || 3;
          return `
            <div style="
              display:grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap:16px;
              margin:20px 0;
            ">
              ${section.items.map((item: string) => `
                <div style="
                  padding:12px;
                  border:1px solid #ddd;
                  border-radius:8px;
                ">
                  ${item}
                </div>
              `).join("")}
            </div>
          `;
        }

        // 🔥 CALLOUT BOXES
        if (section.type === "callout") {
          let bg = "#eef";

          if (section.style === "warning") bg = "#fff3cd";
          if (section.style === "success") bg = "#d4edda";

          return `
            <div style="
              background:${bg};
              padding:12px;
              border-radius:6px;
              margin:15px 0;
            ">
              ${section.content}
            </div>
          `;
        }

        return "";

      }).join("")}

    </div>
    `;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    const data = { sections: [] };
    const finalHTML = buildHTMLFromJSON(data);

    return NextResponse.json({ html: finalHTML });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate page" }, { status: 500 });
  }
}