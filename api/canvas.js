const API_TOKEN = '14945~vFKZRJcFr6aGWrTHwVvJyNn99f3C9PE3FGWDJTMKHGWDXfD49JNnaEheNAfZk7wJ';
const BASE_URL  = 'https://mytrades.instructure.com';

async function fetchAll(url) {
  let results = [];
  let next = url;
  while (next) {
    const res = await fetch(next, {
      headers: { 'Authorization': 'Bearer ' + API_TOKEN }
    });
    if (!res.ok) throw new Error('Canvas error ' + res.status + ' fetching ' + url);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now    = new Date();
    const start  = new Date(now); start.setDate(start.getDate() - 14);
    const end    = new Date(now); end.setDate(end.getDate() + 14);

    const [userArr, courses] = await Promise.all([
      fetchAll(BASE_URL + '/api/v1/users/self'),
      fetchAll(BASE_URL + '/api/v1/courses?enrollment_state=active&per_page=50')
    ]);
    const user = userArr[0];
    const activeCourses = courses.filter(c => c.id && !c.access_restricted_by_date);

    const teacherMap = {};
    await Promise.all(activeCourses.map(async course => {
      const enrollments = await fetchAll(
        BASE_URL + `/api/v1/courses/${course.id}/enrollments?type[]=TeacherEnrollment&per_page=50`
      ).catch(() => []);
      enrollments.forEach(e => {
        const name = e.user?.short_name || e.user?.name;
        if (name && !teacherMap[name]) teacherMap[name] = course.name;
      });
    }));

    const missing = await fetchAll(
      BASE_URL + '/api/v1/users/self/missing_submissions?per_page=50'
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
        BASE_URL + `/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`
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

    res.status(200).json({
      studentName: user?.name || 'Student',
      missing: missingFiltered,
      upcoming: upcomingAll.slice(0, 10),
      teachers: Object.entries(teacherMap).map(([name, course]) => ({ name, course })),
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}