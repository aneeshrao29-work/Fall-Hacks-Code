// Resume ATS checker: resume PDF (+ the job posting on screen, if there is one) → ATS score, breakdown and concrete fixes.
const fs = require('fs');
const { dialog } = require('electron');

const AREAS = ['format', 'keywords', 'impact', 'sections', 'clarity'];
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER' },
    job: { type: 'STRING' },
    verdict: { type: 'STRING' },
    breakdown: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { area: { type: 'STRING', enum: AREAS }, score: { type: 'INTEGER' }, note: { type: 'STRING' } },
        required: ['area', 'score', 'note'] },
    },
    missing: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['score', 'job', 'verdict', 'breakdown', 'missing', 'suggestions'],
};
const SYSTEM = `You are a strict, honest ATS (applicant tracking system) resume checker, like Jobscan or Resume Worded.
You get a resume PDF and a screenshot of the user's screen.
- If the screenshot shows a job posting: job = its title (and company), score the resume AGAINST that posting,
  missing = important skills/keywords from the posting that the resume lacks (max 10).
- Otherwise: job = "", score general ATS-readiness for the resume's own field, missing = keywords recruiters
  in that field expect but the resume lacks (max 6).
score = 0-100 overall (most real resumes land 45-80; don't inflate). breakdown = one entry per area, each 0-100 with a
one-line note: format (single column, parseable text, no tables/images/text boxes/header-footer content, standard fonts),
keywords (match to the job/field), impact (action verbs, numbers, results), sections (contact, education, experience,
skills, projects with standard headings, consistent dates), clarity (concise, no typos, right length: 1 page for students).
verdict = one short sentence. suggestions = up to 6 concrete fixes, most impactful first. Quote their actual wording
when possible, e.g. "Change 'Worked on the website' → 'Built a React site used by 2,000+ students'". Plain text, no markdown.`;

const s = (v, n) => String(v ?? '').trim().slice(0, n);
const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// shoot() screenshots the screen AFTER the file dialog closes, so the job posting behind it is what Gemini sees
async function checkResume(win, file, shoot, callGemini) {
  if (!file) {
    const r = await dialog.showOpenDialog(win, { title: 'Pick your resume (PDF)', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    file = r.filePaths[0];
  }
  if (!/\.pdf$/i.test(file)) return { error: 'pick a PDF (export your resume as PDF first)' };
  const buf = fs.readFileSync(file);
  if (buf.length > 8e6) return { error: 'that PDF is over 8 MB — a resume should be way smaller' };
  const screenshot = await shoot().catch(() => null);
  const parts = [{ inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } },
    ...(screenshot ? [{ inline_data: { mime_type: 'image/jpeg', data: screenshot } }] : []),
    { text: 'Check this resume for ATS.' }];
  const out = await callGemini({ system: SYSTEM, parts, schema: SCHEMA, timeout: 90000 });
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    score: pct(out.score),
    job: s(out.job, 120),
    verdict: s(out.verdict, 240),
    breakdown: arr(out.breakdown).filter((b) => AREAS.includes(b?.area)).slice(0, 5).map((b) => ({ area: b.area, score: pct(b.score), note: s(b.note, 200) })),
    missing: arr(out.missing).map((k) => s(k, 40)).filter(Boolean).slice(0, 10),
    suggestions: arr(out.suggestions).map((k) => s(k, 400)).filter(Boolean).slice(0, 6),
  };
}

module.exports = { checkResume, SCHEMA };
