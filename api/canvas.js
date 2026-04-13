const CLIENT_ID     = '149450000000000200';
const CLIENT_SECRET = 'YVnMAXNL8KeLHt9aZUxC4PtEUAfH2tHF8erQRt2FfNYraQt4PxV7WkLW2a2uXuAm';
const CANVAS_URL    = 'https://mytrades.instructure.com';
const REDIRECT_URI  = 'https://ncstcv.vercel.app/auth/callback.html';

async function fetchAll(url, token) {
  let results = [];
  let next = url;
  while (next) {
    const res = await fetch(next, {
      headers: { 'Authorization': 'Bearer ' + token }
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
  return (name || '')
    .replace(/^AAA-Master NCST\s*/i, '')
    .replace(/^Master\s*/i, '')
    .replace(/^[A-Z0-9]+:[A-Z0-9]+:NCST\s*/i, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  if (action === 'exchange') {
    const { code } = req.method === 'POST' ? req.body : req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
      const tokenRes = await fetch(CANVAS_URL + '/login/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          code
        })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
      return res.status(200).json({ access_token: tokenData.access_token });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'data') {
    const token    = req.method === 'POST' ? req.body?.token : req.query.token;
    const courseId = req.method === 'POST' ? req.body?.courseId : req.query.courseId;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    try {
      const now   = new Date();
      const start = new Date(now); start.setDate(start.getDate() - 14);
      const end   = new Date(now); end.setDate(end.getDate() + 14);

      const userArr = await fetchAll(CANVAS_URL + '/api/v1/users/self', token);
      const user    = userArr[0];
      const userId  = user?.id;

      const missing = await fetchAll(
        CANVAS_URL + `/api/v1/users/${userId}/missing_submissions?per_page=50`, token
      ).catch(() => []);

      const missingFiltered = missing.filter(a => {
        if (courseId && String(a.course_id) !== String(courseId)) return false;
        const due = a.due_at ? new Date(a.due_at) : null;
        return due && due >= start && due <= now;
      });

      let upcoming = [];
      if (courseId) {
        const assignments = await fetchAll(
          CANVAS_URL + `/api/v1/courses/${courseId}/assignments?per_page=50&order_by=due_at`, token
        ).catch(() => []);
        assignments.forEach(a => {
          if (!a.due_at) return;
          const due = new Date(a.due_at);
          if (due > now && due <= end) {
            upcoming.push({ name: a.name, due_at: a.due_at });
          }
        });
      } else {
        const courses = await fetchAll(
          CANVAS_URL + '/api/v1/courses?enrollment_state=active&per_page=50', token
        ).catch(() => []);
        await Promise.all(courses.filter(c => c.id).map(async course => {
          const assignments = await fetchAll(
            CANVAS_URL + `/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`, token
          ).catch(() => []);
          assignments.forEach(a => {
            if (!a.due_at) return;
            const due = new Date(a.due_at);
            if (due > now && due <= end) {
              upcoming.push({ name: a.name, due_at: a.due_at, courseName: shortCourse(course.name) });
            }
          });
        }));
      }

      upcoming.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

      return res.status(200).json({
        studentName: user?.name || 'Student',
        missing: missingFiltered.map(a => ({ name: a.name, due_at: a.due_at })),
        upcoming: upcoming.slice(0, 10),
        dateRange: { start: start.toISOString(), end: end.toISOString() }
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'login') {
    const courseId  = req.query.courseId || '';
    const state     = courseId ? Buffer.from(JSON.stringify({ courseId })).toString('base64') : '';
    const authUrl   = `${CANVAS_URL}/login/oauth2/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=url:GET|/api/v1/users/:id url:GET|/api/v1/users/:user_id/missing_submissions url:GET|/api/v1/courses/:course_id/assignments${state ? '&state=' + state : ''}`;
    return res.redirect(302, authUrl);
  }

  return res.status(400).json({ error: 'Unknown action' });
}