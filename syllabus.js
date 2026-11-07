// Syllabus sidekick: course-outline PDFs → every deadline → a calendar (.ics) file + "what's due this week".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, dialog, shell } = require('electron');

const TYPES = ['exam', 'midterm', 'quiz', 'assignment', 'project', 'lab', 'presentation', 'other'];
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          course: { type: 'STRING' }, title: { type: 'STRING' }, type: { type: 'STRING', enum: TYPES },
          date: { type: 'STRING' }, time: { type: 'STRING' }, weight: { type: 'STRING' },
        },
        required: ['course', 'title', 'type', 'date', 'time', 'weight'],
      },
    },
  },
  required: ['items'],
};
const system = () => `You read university course outlines / syllabi. Extract EVERY graded or dated item: exams, midterms,
quizzes, assignments, projects, labs, presentations and the final exam. For each item:
course = course code like "CMPT 225" (or the course name if there is no code); title = short name like "Assignment 3";
type = one of ${TYPES.join(', ')}; date = YYYY-MM-DD (work out the year from the term/dates in the document;
today is ${localDate()}); time = due time as HH:MM 24h, or "" if none;
weight = grade weight like "15%", or "". Skip items whose date can't be determined. No duplicates.`;

// local calendar date (YYYY-MM-DD): toISOString() is UTC, which is already 'tomorrow' on a Vancouver evening
const localDate = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const storeFile = () => path.join(app.getPath('userData'), 'syllabus.json');
const icsFile = () => path.join(app.getPath('downloads'), 'jepi-deadlines.ics');
const load = () => { try { const d = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; } };
const s = (v, n) => String(v ?? '').trim().slice(0, n);
const keyOf = (i) => `${i.course}|${i.title}|${i.date}`.toLowerCase();

async function importSyllabus(win, paths, callGemini) {
  if (!paths?.length) {
    const r = await dialog.showOpenDialog(win, { title: 'Pick your course outline PDFs', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled) return { canceled: true };
    paths = r.filePaths;
  }
  paths = paths.filter((p) => /\.pdf$/i.test(p)).slice(0, 8);
  if (!paths.length) return { error: 'pick PDF course outlines' };
  let total = 0;
  const parts = paths.map((p) => {
    const buf = fs.readFileSync(p);
    total += buf.length;
    if (total > 14e6) throw new Error('those PDFs are too big together (max ~14 MB total) — try fewer at a time');
    return { inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } };
  });
  parts.push({ text: 'Extract all deadlines from these course outlines.' });
  const out = await callGemini({ system: system(), parts, schema: SCHEMA, timeout: 90000 });

  const fresh = (Array.isArray(out.items) ? out.items : [])
    .map((i) => ({ course: s(i.course, 40), title: s(i.title, 120), type: TYPES.includes(i.type) ? i.type : 'other',
      date: s(i.date, 10), time: /^\d{2}:\d{2}$/.test(i.time) ? i.time : '', weight: s(i.weight, 20) }))
    .filter((i) => i.title && /^\d{4}-\d{2}-\d{2}$/.test(i.date) && !Number.isNaN(Date.parse(i.date)));
  const merged = new Map(load().map((i) => [keyOf(i), i])); // re-importing the same outline updates, never duplicates
  for (const i of fresh) merged.set(keyOf(i), i);
  const all = [...merged.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  fs.writeFileSync(storeFile(), JSON.stringify(all, null, 2));
  fs.writeFileSync(icsFile(), toICS(all));
  return { found: fresh.length, total: all.length, ics: icsFile(), week: dueSoon(7, all) };
}

// items due from today through the next `days` days
function dueSoon(days = 7, items = load()) {
  const today = localDate(), end = localDate(Date.now() + days * 864e5);
  return items.filter((i) => i.date >= today && i.date <= end);
}

function showCalendarFile() {
  if (fs.existsSync(icsFile())) shell.showItemInFolder(icsFile());
}

// RFC 5545 calendar: all-day events (or 1h if there's a due time) with a reminder the day before
function toICS(items) {
  const esc = (t) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const compact = (d) => d.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const nextDay = (d) => compact(new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10));
  const ev = items.map((i) => {
    const when = i.time
      ? [`DTSTART:${compact(i.date)}T${i.time.replace(':', '')}00`, `DURATION:PT30M`]
      : [`DTSTART;VALUE=DATE:${compact(i.date)}`, `DTEND;VALUE=DATE:${nextDay(i.date)}`];
    return ['BEGIN:VEVENT', `UID:${crypto.createHash('sha1').update(keyOf(i)).digest('hex')}@jepi`, `DTSTAMP:${stamp}`, ...when,
      `SUMMARY:${esc(`${i.course} ${i.title}${i.weight ? ` (${i.weight})` : ''}`)}`, `DESCRIPTION:${esc(`${i.type} · added by JepiTheGenie`)}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Due tomorrow: ${i.course} ${i.title}`)}`, 'END:VALARM',
      'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JepiTheGenie//Syllabus//EN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR', ''].join('\r\n');
}

module.exports = { importSyllabus, dueSoon, showCalendarFile, toICS };
