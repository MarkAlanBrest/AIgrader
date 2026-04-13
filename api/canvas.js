async function fetchAll(url, token) {
  let results = [];
  let next = url;
  while (next) {
    const res = await fetch(next, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Canvas error ' + res.status + ' at ' + url);
    const data = await res.json();
    results = results.concat(Array.isArray(data) ? data : [data]);
    const link = res.headers.get('Link') || '';
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    next = match ? match[1] : null;
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, baseUrl } = req.body;
  if (!token || !baseUrl) return res.status(400).json({ error: 'Missing token or baseUrl' });

  const BASE = baseUrl.replace(/\/$/, '');

  try {
    const now   = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 14);
    const end   = new Date(now); end.setDate(end.getDate() + 14);

    const [userArr, courses] = await Promise.all([
      fetchAll(BASE + '/api/v1/users/self', token),
      fetchAll(BASE + '/api/v1/courses?enrollment_state=active&per_page=50', token)
    ]);
    const user = userArr[0];
    const activeCourses = courses.filter(c => c.id && !c.access_restricted_by_date);

    const teacherMap = {};
    await Promise.all(activeCourses.map(async course => {
      const enrollments = await fetchAll(
        BASE + `/api/v1/courses/${course.id}/enrollments?type[]=TeacherEnrollment&per_page=50`, token
      ).catch(() => []);
      enrollments.forEach(e => {
        const name = e.user?.short_name || e.user?.name;
        if (name && !teacherMap[name]) teacherMap[name] = course.name;
      });
    }));

    const missing = await fetchAll(
      BASE + '/api/v1/users/self/missing_submissions?per_page=50', token
    ).catch(() => []);

    const missingFiltered = missing.filter(a => {
      const due = a.due_at ? new Date(a.due_at) : null;
      return due && due >= start && due <= now;
    }).map(a => {
      const course = activeCourses.find(c => c.id === a.course_id);
      return { name: a.name, due_at: a.due_at, courseName: course?.name || '' };
    });

    const upcomingAll = [];
    await Promise.all(activeCourses.map(async course => {
      const assignments = await fetchAll(
        BASE + `/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`, token
      ).catch(() => []);
      assignments.forEach(a => {
        if (!a.due_at) return;
        const due = new Date(a.due_at);
        if (due > now && due <= end && !a.locked_for_user) {
          upcomingAll.push({ name: a.name, due_at: a.due_at, courseName: course.name });
        }
      });
    }));
    upcomingAll.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    const uniqueTeachers = [];
    const seen = new Set();
    Object.entries(teacherMap).forEach(([name, course]) => {
      if (!seen.has(name)) { seen.add(name); uniqueTeachers.push({ name, course }); }
    });

    res.status(200).json({
      studentName: user?.name || 'Student',
      missing: missingFiltered,
      upcoming: upcomingAll.slice(0, 10),
      teachers: uniqueTeachers,
      dateRange: { start: start.toISOString(), end: end.toISOString() }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}