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
        "Pick the student, enter the hours and the date, and optionally a task and note.",
        '"Student was present" is ticked by default — untick it for a no-show.',
        'Click "Log session".',
      ] },
      { tip: "A no-show still draws the hours down, but it's tracked separately as “missed” so everyone can see it." },
    ] },
    { n: 4, heading: "Deadlines", blocks: [
      { p: "Each student's hours with you have a use-by date, shown in the “Use by” column and marked red once passed." },
      { tip: "After the deadline those hours expire — you can't log new sessions against them. Ask an admin to extend the deadline or allocate fresh hours." },
    ] },
    { n: 5, heading: "Fix or void a session", blocks: [
      { p: 'On the "Sessions" page, click "Correct" on any active session to change its hours, date, task, note, or attendance — or to void it, which returns the hours to the student. The student is notified of every change.' },
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
      { p: 'Sign in with Google. The cross-program dashboard shows every program as a card with its students, mentors, and hours, plus a “Pending approvals” box when students are waiting. Click a program to open its full page.' },
    ] },
    { n: 2, heading: "Add & approve students", blocks: [
      { steps: [
        "Open a program and paste one or more student emails to register them; they confirm their name and Telegram on first sign-in.",
        'Students who signed up on their own appear under "Pending approvals" — approve them, then allocate their hours.',
      ] },
    ] },
    { n: 3, heading: "Allocate hours (per mentor)", blocks: [
      { steps: [
        'Open a student ("Manage") and find "Hour allocations by mentor".',
        "Enter the hours and a deadline (required), then click Set to replace or Add to top up.",
        "For Master's Program students, also enter the Amount paid ($).",
      ] },
      { tip: "Deadlines are enforced: once one passes, the unused hours expire and mentors can no longer log sessions against them. Extend the deadline to reopen them." },
    ] },
    { n: 4, heading: "Register & assign mentors", blocks: [
      { steps: [
        'Open the "Mentors" page.',
        "Register a new mentor by email + name + the programs they work in, or click Edit on an existing mentor to change their program assignments.",
        "Mentors set their own booking links after they're assigned.",
      ] },
      { tip: "Any admin can assign any mentor — including other admins and yourself — to any program. The five admins are also mentors, so they appear in this list too." },
    ] },
    { n: 5, heading: "Switch between Admin and Mentor", blocks: [
      { p: "You are both an admin and a mentor. Use the Admin / Mentor toggle in the top-left of the header to switch dashboards." },
      { p: "In Mentor view you log your own sessions and set booking links like any mentor — once an admin (you or another) has assigned you to a program." },
    ] },
    { n: 6, heading: "Reading the numbers", blocks: [
      { bullets: [
        "Allotted — total hours granted.",
        "Completed — hours actually delivered.",
        "Missed — no-show hours (charged but not delivered).",
        "Expired — unused hours past their deadline.",
        "Remaining — hours still usable (allotted minus completed, missed, and expired).",
      ] },
    ] },
    { n: 7, heading: "Nothing happens silently", blocks: [
      { p: "Every hour change, session, void, approval, and deadline event notifies the student (and the mentor where relevant) and lands in the bell. Allocation changes are also kept in an audit trail on the student's page." },
    ] },
  ],
};

(async () => {
  for (const g of [student, mentor, admin]) await build(g);
  console.log("Generated:", fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf")).join(", "));
})();
