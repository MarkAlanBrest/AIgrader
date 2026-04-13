const TEACHER_TOKEN = '14945~vFKZRJcFr6aGWrTHwVvJyNn99f3C9PE3FGWDJTMKHGWDXfD49JNnaEheNAfZk7wJ';
const BASE_URL      = 'https://mytrades.instructure.com';

async function fetchAll(url) {
  let results = [];
  let next = url;
  while (next) {
    const res = await fetch(next, {
      headers: { 'Authorization': 'Bearer ' + TEACHER_TOKEN }
    });
    if (!res.ok) throw new Error('Canvas error ' + res.status);
    const data = await res.json();
    results = results.concat(Array.isArray(data) ? data : [data]);
    const link = res.headers.get('Link') || '';
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    next = match ? match[1] : null;
  }
  return results;
}

function shortCourse(name) {
  return name
    .replace(/^AAA-Master NCST\s*/i, '')
    .replace(/^Master\s*/i, '')
    .replace(/^[A-Z0-9]+:[A-Z0-9]+:NCST\s*/i, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { courseId } = req.query;
  if (!courseId) return res.status(400).json({ error: 'Missing courseId parameter' });

  try {
    const now   = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 14);
    const end   = new Date(now); end.setDate(end.getDate() + 14);

    const [course, assignments] = await Promise.all([
      fetch(BASE_URL + `/api/v1/courses/${courseId}`, {
        headers: { 'Authorization': 'Bearer ' + TEACHER_TOKEN }
      }).then(r => r.json()),
      fetchAll(BASE_URL + `/api/v1/courses/${courseId}/assignments?per_page=50&order_by=due_at`)
    ]);

    const courseName = shortCourse(course.name || '');
    const missing  = [];
    const upcoming = [];

    assignments.forEach(a => {
      if (!a.due_at) return;
      const due = new Date(a.due_at);
      if (due >= start && due <= now) {
        missing.push({ name: a.name, due_at: a.due_at, courseName });
      } else if (due > now && due <= end) {
        upcoming.push({ name: a.name, due_at: a.due_at, courseName });
      }
    });

    missing.sort((a, b)  => new Date(b.due_at) - new Date(a.due_at));
    upcoming.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    res.status(200).json({
      courseName,
      missing,
      upcoming,
      dateRange: { start: start.toISOString(), end: end.toISOString() }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
