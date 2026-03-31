import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "public", "comments.json");

type CommentItem = {
  id: string;
  category: string;
  text: string;
};

function readComments(): CommentItem[] {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
  }

  const raw = fs.readFileSync(filePath, "utf-8") || "[]";
  let data: any[] = [];

  try {
    data = JSON.parse(raw);
  } catch {
    data = [];
  }

  // Normalize: ensure each item has an id
  let changed = false;
  const normalized: CommentItem[] = data.map((item, idx) => {
    if (!item.id) {
      changed = true;
      return {
        id: `c_${Date.now()}_${idx}`,
        category: String(item.category || "").trim(),
        text: String(item.text || "").trim(),
      };
    }
    return {
      id: String(item.id),
      category: String(item.category || "").trim(),
      text: String(item.text || "").trim(),
    };
  });

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  return normalized;
}

function writeComments(items: CommentItem[]) {
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
}

// GET: return all comments
export async function GET() {
  const data = readComments();
  return Response.json(data);
}

// POST: add new comment
// body: { category: string, text: string }
export async function POST(req: Request) {
  const { category, text } = await req.json();

  const data = readComments();
  const item: CommentItem = {
    id: `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    category: String(category || "").trim(),
    text: String(text || "").trim(),
  };

  data.push(item);
  writeComments(data);

  return Response.json({ success: true, item });
}

// PUT: update comment or rename category
// 1) Update single comment:
//    { id, category, text }
// 2) Rename category:
//    { oldCategory, newCategory }
export async function PUT(req: Request) {
  const body = await req.json();
  const data = readComments();

  // Rename category
  if (body.oldCategory && body.newCategory) {
    const oldCat = String(body.oldCategory).trim();
    const newCat = String(body.newCategory).trim();

    const updated = data.map((item) =>
      item.category === oldCat
        ? { ...item, category: newCat }
        : item
    );

    writeComments(updated);
    return Response.json({ success: true, updatedCount: updated.length });
  }

  // Update single comment
  if (body.id) {
    const id = String(body.id);
    const idx = data.findIndex((c) => c.id === id);
    if (idx === -1) {
      return new Response("Not found", { status: 404 });
    }

    const updated: CommentItem = {
      ...data[idx],
      category: body.category !== undefined ? String(body.category).trim() : data[idx].category,
      text: body.text !== undefined ? String(body.text).trim() : data[idx].text,
    };

    data[idx] = updated;
    writeComments(data);
    return Response.json({ success: true, item: updated });
  }

  return new Response("Invalid PUT body", { status: 400 });
}

// DELETE: delete comment or entire category
// 1) Delete single comment: { id }
// 2) Delete category and all its comments: { category }
export async function DELETE(req: Request) {
  const body = await req.json();
  const data = readComments();

  // Delete by id
  if (body.id) {
    const id = String(body.id);
    const filtered = data.filter((c) => c.id !== id);
    writeComments(filtered);
    return Response.json({ success: true, deletedId: id });
  }

  // Delete entire category
  if (body.category) {
    const cat = String(body.category).trim();
    const filtered = data.filter((c) => c.category !== cat);
    writeComments(filtered);
    return Response.json({ success: true, deletedCategory: cat });
  }

  return new Response("Invalid DELETE body", { status: 400 });
}
