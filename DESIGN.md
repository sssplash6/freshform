# Design system

## Register

Product UI. This is a role-based mentoring ledger for staff, mentors, and
students. It should feel confident and precise rather than institutional or
like a generic SaaS dashboard: the numbers are the product, so the design's job
is to make them fast to read and impossible to mistrust.

Bolder here means stronger hierarchy, clearer weight contrast, and color that
carries meaning. It does not mean theatrics — this is a ledger people rely on
for hours and money, and drama undermines that.

## Color

Color identifies; it never decorates. Every hue below answers a question the
reader would otherwise have to work out by reading.

- **Brand** (deep blue) is structural chrome and primary action. `brand-dark`
  is its hover; `brand-soft` a tint background.
- **Accent** (orange) means hours, progress, and the active navigation state.
  The bright `accent` is for fills, dots, and bars; `accent-ink` is the orange
  used for text and stat readouts.
- **Red** is only destructive or overdrawn state.
- **Panel tones** say who owns a region of data. `log` (amber) is filled in by
  mentors logging sessions. `plan` (violet) is assigned by an admin. `total`
  (brand blue) is derived and editable by nobody. These come from the
  spreadsheet these views replace, which color-coded the same split.
- **Person tones** give each mentor one stable color, hashed from their id in
  `lib/person-tone.ts` and shown as an initials badge. A column of sessions can
  then be read by who ran them without reading a single name. Tints stay muted:
  eight saturated crayons would look like a toy.
- **Line** is borders and quiet separation; **canvas** is the page ground and
  **surface** is a card.
- Text is a two-tone system: **ink** for primary, **muted-fg** for secondary.

Use the semantic tokens in `src/app/globals.css`. Do not add a hue without a
question it answers. No gradient text, no glassmorphism, no colored side-stripe
borders; a panel's color goes in a rule across its top and a tint in its header.

## Type and spacing

Geist is the single product typeface. Numbers use tabular figures. Durations
are minutes: one meeting or one task budget reads as a plain minute count
("90 min"), and only roll-up totals — an allotment, a balance — split into hours
and minutes ("18h 20m"), because nobody reads "1100 minutes remaining" as an
amount of time. A figure always carries its own unit, so no label or suffix
should repeat it. Push scale
contrast: a page's `h1` and its lead statistic should be unmistakably larger
than everything around them, and small-caps eyebrow labels should be genuinely
small. Data stays dense enough for staff work without turning every statistic
into a card. Use horizontal rules and whitespace before adding a container.

## Components

Use native controls unless a custom interaction offers a demonstrated benefit.
A custom control owes the keyboard everything the native one gave: `Select` is a
full ARIA combobox (arrows, Home/End, typeahead, Escape restoring focus) with one
tab stop, and a required one is caught in the BROWSER — its value rides a
validatable input, not a hidden one, so "pick a mentor" is answered at the
control instead of by a server error a second later. Interactive controls need
visible keyboard focus and a minimum 44px touch target. Forms show an inline,
announced success or error result, and submit through `SubmitButton`, which reads
its own form's pending state.

Below `sm` a table row is a stack of labelled lines, not a sideways swipe: nine
columns do not fit a phone, and a swipe nothing on screen suggests is not
navigation. Any list that can grow without bound is paged, and the narrowing —
search, filter, date range — belongs in the query, never in a `.filter()` over
everything.

Every role section has an error boundary offering a retry and a way back. One
vocabulary throughout: mentor, student, task, program.

- `PageHeader` is the page banner: eyebrow, large title, subtitle, actions, and
  an optional oversized ghost monogram watermarked into the corner.
- `Panel` / `PanelHeader` is a titled region carrying a panel tone.
- `PersonChip` / `PersonBadge` render a person in their identity color.
- `Table` / `Tr` / `Td` is the one table chrome; give every `Td` a `label` so its
  stacked form still says what the value means.
- `Pagination` states the slice in words and pages with links, so a page is
  shareable and the back button behaves.
- `HoursBreakdown` is an allotment as one bar and its key — delivered, missed,
  expired, still yours — so the proportions answer the question the four
  figures used to make people subtract for. Hours logged out of plan sit
  outside the bar; they were never part of what was bought.
- `LedgerBoard` is the tracking spreadsheet's whole tab on one screen: the
  balance across the top, meetings down the left, the plan down the right. That
  side-by-side is what the sheet did that stacked panels don't — the team reads
  a student by holding both halves at once. It leads the student page and is
  read-only; the panels under it are the workbench. Both of its columns split
  the same way, ahead of us then behind us, because it is the same question
  asked of meetings and of tasks.
- `ScheduledMeetings` is the plan-tone counterpart to the amber meetings log.
  Coming and completed are shaped differently on purpose — a column of
  calendar leaves against a timeline of dots — so nobody has to read a heading
  to know which half they are looking at.

A logged session is TWO questions, asked side by side and shaped identically:
`AttendancePicker` (what happened) and `HoursKindPicker` (whose hours it
spends). Each states the consequence of the chosen option underneath, because
neither is guessable from its label alone: absent still charges, extra does
not.

## Motion

Motion is brief and eases out. Interaction feedback is 150–180ms. Entrances are
choreographed rather than simultaneous: rows `deal-in` with a ~24ms stagger,
panels `lift-in`, and `Meter` grows its fill from empty on mount so that
spending hours is something you watch happen once. Nothing loops, nothing
bounces, nothing idles. Respect reduced-motion preferences — including staggered delays, which must be
zeroed rather than merely shortened.
