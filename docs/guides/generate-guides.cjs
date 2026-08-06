/*
 * Generates the three freshlog instruction PDFs (student, mentor, admin).
 * Pure JS via pdfkit — no browser needed.
 *   Setup:  npm init -y && npm install pdfkit
 *   Run:    node generate-guides.cjs <outputDir>
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const BRAND = "#ed7a2d";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const TIPBG = "#fff4e8";

const MARGIN = 60;

function build({ file, title, subtitle, sections }) {
  const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, bufferPages: true });
  const stream = fs.createWriteStream(path.join(OUT, file));
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - MARGIN * 2;
  const bottom = pageH - 72;

  const ensure = (h) => {
    if (doc.y + h > bottom) doc.addPage();
  };

  // ---- Title block (page 1) ----
  doc.rect(0, 0, pageW, 8).fill(BRAND);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(13);
  doc.text("freshlog", MARGIN, 48);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(26);
  doc.text(title, MARGIN, 74);
  doc.fillColor(MUTED).font("Helvetica").fontSize(11);
  doc.text(subtitle, { width: contentW });
  doc.moveTo(MARGIN, doc.y + 12).lineTo(pageW - MARGIN, doc.y + 12).strokeColor(LINE).lineWidth(1).stroke();
  doc.y += 26;

  const heading = (n, text) => {
    ensure(48);
    const y = doc.y;
    doc.circle(MARGIN + 9, y + 9, 10).fill(BRAND);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text(String(n), MARGIN + 5, y + 4, { width: 8, align: "center" });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(text, MARGIN + 28, y + 1, { width: contentW - 28 });
    doc.y = Math.max(doc.y, y + 22) + 6;
  };

  const para = (text) => {
    ensure(26);
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(text, MARGIN, doc.y, { width: contentW, lineGap: 2 });
    doc.y += 6;
  };

  const list = (items, numbered) => {
    doc.font("Helvetica").fontSize(10.5).fillColor(INK);
    items.forEach((it, i) => {
      ensure(24);
      const marker = numbered ? `${i + 1}.` : "•";
      const x = MARGIN + 6;
      const startY = doc.y;
      doc.fillColor(BRAND).font(numbered ? "Helvetica-Bold" : "Helvetica").text(marker, x, startY, { width: 16 });
      doc.fillColor(INK).font("Helvetica").text(it, x + 20, startY, { width: contentW - 26, lineGap: 2 });
      doc.y += 4;
    });
    doc.y += 4;
  };

  const tip = (text) => {
    doc.font("Helvetica").fontSize(10);
    const h = doc.heightOfString(text, { width: contentW - 44, lineGap: 2 }) + 20;
    ensure(h + 8);
    const y = doc.y;
    doc.roundedRect(MARGIN, y, contentW, h, 6).fill(TIPBG);
    doc.rect(MARGIN, y, 4, h).fill(BRAND);
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(9).text("TIP", MARGIN + 16, y + 10);
    doc.fillColor(INK).font("Helvetica").fontSize(10).text(text, MARGIN + 44, y + 9, { width: contentW - 60, lineGap: 2 });
    doc.y = y + h + 12;
  };

  for (const s of sections) {
    heading(s.n, s.heading);
    for (const b of s.blocks) {
      if (b.p) para(b.p);
      else if (b.steps) list(b.steps, true);
      else if (b.bullets) list(b.bullets, false);
      else if (b.tip) tip(b.tip);
    }
    doc.y += 6;
  }

  // ---- Footers on every page ----
  // Zero the bottom margin while drawing so pdfkit doesn't treat footer text
  // (below the content area) as an overflow and append blank pages.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(MARGIN, pageH - 54).lineTo(pageW - MARGIN, pageH - 54).strokeColor(LINE).lineWidth(1).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text(`freshlog — ${title}`, MARGIN, pageH - 46, { width: contentW / 2, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, MARGIN + contentW / 2, pageH - 46, { width: contentW / 2, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return new Promise((res) => stream.on("finish", res));
}

const student = {
  file: "student-guide.pdf",
  title: "Student Guide",
  subtitle: "How to sign in, see your mentoring hours, and book sessions on freshlog.",
  sections: [
    { n: 1, heading: "Signing in", blocks: [
      { steps: [
        "Open the freshlog link your program shared with you.",
        'Click "Continue with Google" and sign in with the email your program registered.',
        "The first time only: enter your full name and your Telegram username, then continue.",
      ] },
      { tip: "If you signed up yourself (your email wasn't pre-registered), an admin has to approve you first. You'll see a “registration received” message until then." },
    ] },
    { n: 2, heading: "Your hours (home page)", blocks: [
      { p: "The top strip summarises your hours:" },
      { bullets: [
        "Allotted — total hours granted to you.",
        "Completed — hours you've actually used in sessions.",
        "Missed — sessions you didn't show up to (still counted).",
        "Remaining — hours you can still use.",
        "Expired — hours that passed their deadline unused (only shown if you have any).",
      ] },
      { p: "Below that, “Hours with each mentor” shows your balance with every mentor, a progress bar, and the date you need to use them by." },
    ] },
    { n: 3, heading: "Deadlines matter", blocks: [
      { p: "Every block of hours has a use-by deadline. Book and use them before that date." },
      { tip: "Once a deadline passes, any unused hours in that block expire and can no longer be used. freshlog notifies you before the deadline and when it passes." },
    ] },
    { n: 4, heading: "Booking a session", blocks: [
      { steps: [
        'Go to "Book a session".',
        "Each mentor card shows how many hours you have left with them and a booking button (their own calendar).",
        "Book a time. After the session, your mentor logs it and it appears in your session history.",
      ] },
    ] },
    { n: 5, heading: "Missed sessions (no-shows)", blocks: [
      { p: "If you miss a session you booked, your mentor can mark you as absent. Those hours are still deducted and shown as “missed” — so try not to miss, and let your mentor know in advance if plans change." },
    ] },
    { n: 6, heading: "Notifications", blocks: [
      { p: "The bell icon (top-right) collects everything important: hours granted, sessions logged, deadline reminders, and approval updates. A red dot means you have unread items." },
    ] },
  ],
};

const mentor = {
  file: "mentor-guide.pdf",
  title: "Mentor Guide",
  subtitle: "How to sign in, share your booking link, and log sessions on freshlog.",
  sections: [
    { n: 1, heading: "Signing in", blocks: [
      { steps: [
        'Open freshlog and click "Continue with Google".',
        "Sign in with your @freshman.academy account. Enter your full name if asked.",
      ] },
      { tip: "If your account is brand new you'll see “not yet assigned to a program.” An admin needs to assign you before students and session logging appear — check back shortly after." },
    ] },
    { n: 2, heading: "Set your booking link", blocks: [
      { steps: [
        'On "My students", find the "Your booking links" panel.',
        "Paste your calendar link (e.g. Calendly, starting with https://) for each program you're assigned to, and save.",
        "Students in that program can now book you. Until you add a link they see “no booking link yet.”",
      ] },
    ] },
    { n: 3, heading: "Log a completed session", blocks: [
      { steps: [
        `Use the "Log a completed session" form on "My students" (or on a student's page).`,
        'Pick the student, then pick the task the meeting went toward — required, and the list holds exactly the tasks an admin allocated your hours for.',
        "Enter the hours and the date, and note what you covered if it helps the next person.",
        '"Student was present" is ticked by default — untick it for a no-show.',
        'Click "Log session".',
      ] },
      { tip: "A no-show still draws the hours down, but it's tracked separately as “missed” so everyone can see it." },
      { tip: "Empty task list? No hours have been allocated to you for that student yet. Ask an admin — hours and the task they are for arrive together." },
    ] },
    { n: 4, heading: "Deadlines", blocks: [
      { p: "Each student's hours with you have a use-by date, shown in the “Use by” column and marked red once passed." },
      { tip: "After the deadline those hours expire — you can't log new sessions against them. Ask an admin to extend the deadline or allocate fresh hours." },
    ] },
    { n: 5, heading: "Fix or void a session", blocks: [
      { p: 'On the "Sessions" page, click "Correct" on any active session to change the task it counted toward, its hours, date, notes, or attendance — or to void it, which returns the hours to the student. The student is notified of every change.' },
    ] },
    { n: 6, heading: "Feedback & notifications", blocks: [
      { p: '"My feedback" shows the ratings students left you. The bell icon (top-right) collects your updates.' },
    ] },
  ],
};

const admin = {
  file: "admin-guide.pdf",
  title: "Admin Guide",
  subtitle: "Running programs on freshlog: students, hours, mentors, and your dual admin/mentor role.",
  sections: [
    { n: 1, heading: "The dashboard", blocks: [
      { p: 'Sign in with Google. The cross-program dashboard shows every program as a card with its students, mentors, and hours, plus a “Pending approvals” box when students are waiting. Click a program to open it.' },
      { p: "A program opens on three tabs: Overview (its numbers, what needs attention, the latest meetings, the tasks in flight, its mentors), Students (one row per student, click to open them), and Settings (name, cohorts, mentors, removing students, closing the program)." },
    ] },
    { n: 2, heading: "Add & approve students", blocks: [
      { steps: [
        "Open a program, go to the Students tab, and paste one or more student emails to register them; they confirm their name and Telegram on first sign-in.",
        'Students who signed up on their own appear under "Pending approvals" — approve them, then allocate their hours.',
      ] },
    ] },
    { n: 3, heading: "Assign a task, with the hours for it", blocks: [
      { p: "Assigning work and granting the hours for it are one act, so there is one form for both, at the foot of the Tasks panel." },
      { steps: [
        'Open a student from the Students tab and find "Assign a task" under Tasks.',
        "Pick the consultant, then the task (one of the presets or type your own), the hours, and the use-by date.",
        "For Master's Program students, also enter what they paid for these hours.",
        "The hours are added to what that consultant already holds with the student, and become the task's budget. Picking a task they already have open tops that budget up instead of starting a second copy of it.",
      ] },
      { tip: "Deadlines are enforced: once one passes, the unused hours expire and mentors can no longer log sessions against them. Extend the deadline to reopen them." },
      { tip: "To fix a mistake rather than grant more, use the ⋮ menu on the mentor's row in \u201cHours by mentor\u201d — it sets the total hours, the use-by date and the amount paid. Raising the total there also asks which task the extra hours are for." },
    ] },
    { n: 4, heading: "Tasks — what the hours are for", blocks: [
      { p: "Hours are always granted for a task, so the plan and the ledger are the same thing seen from two sides: the task carries the hours as its budget, and the mentor logs each session against one of the student's tasks." },
      { bullets: [
        "The Tasks panel on a student's page shows each task, its consultant, hours logged against hours budgeted, and its progress.",
        "Progress follows the hours on its own: the first session moves a task to In progress, reaching the budget marks it Done. Setting progress by hand pins it there.",
        "A task always arrives with hours, because a task nobody has hours for can't be worked on.",
        "Going over a task's budget is warned, never blocked — the number turns amber.",
      ] },
    ] },
    { n: 5, heading: "Register & assign mentors", blocks: [
      { steps: [
        'Open the "Mentors" page to register a new mentor by email + name + the programs they work in, or click Edit to change an existing mentor\'s assignments.',
        "A program's Settings tab does the same from the other side: assign any mentor to that program (or one of its cohorts), or remove them.",
        "Mentors set their own booking links after they're assigned.",
      ] },
      { tip: "Allocating a student hours from a mentor who isn't in their program yet assigns them to it automatically." },
      { tip: "Any admin can assign any mentor — including other admins and yourself — to any program. The five admins are also mentors, so they appear in this list too." },
    ] },
    { n: 6, heading: "Program settings", blocks: [
      { bullets: [
        "Rename the program. (The Master's billing rule matches on the name, so renaming that one turns it off.)",
        "Add cohorts — programs are flat until you do — or delete an empty one.",
        "Assign or remove its mentors.",
        "Remove a student, which deletes their account, enrollment, allocations and tasks. Blocked once they have a logged session: at that point the record is part of the hour ledger.",
        "Close the program down, once no students or scoped staff are left in it.",
      ] },
    ] },
    { n: 7, heading: "Switch between Admin and Mentor", blocks: [
      { p: "You are both an admin and a mentor. Use the Admin / Mentor toggle in the top-left of the header to switch dashboards." },
      { p: "In Mentor view you log your own sessions and set booking links like any mentor — once an admin (you or another) has assigned you to a program." },
    ] },
    { n: 8, heading: "Reading the numbers", blocks: [
      { bullets: [
        "Allotted — total hours granted.",
        "Completed — hours actually delivered.",
        "Missed — no-show hours (charged but not delivered).",
        "Expired — unused hours past their deadline.",
        "Remaining — hours still usable (allotted minus completed, missed, and expired).",
      ] },
    ] },
    { n: 9, heading: "Nothing happens silently", blocks: [
      { p: "Every hour change, session, void, approval, and deadline event notifies the student (and the mentor where relevant) and lands in the bell. Allocation changes are also kept in an audit trail on the student's page." },
    ] },
  ],
};

(async () => {
  for (const g of [student, mentor, admin]) await build(g);
  console.log("Generated:", fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf")).join(", "));
})();
