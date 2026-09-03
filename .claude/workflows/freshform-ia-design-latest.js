export const meta = {
  name: 'freshform-ia-design',
  description: 'Three independent information-architecture proposals for the freshform redesign, each from a different design angle, grounded in the audit digests and the owner decisions',
  phases: [{ title: 'Design', detail: 'three architects, three angles' }],
}

const SP = '/private/tmp/claude-501/-Users-workingmyassof-freshform/39d19c2b-ff94-4c22-a6f5-41fcc7f9a4fe/scratchpad'
const REPO = '/Users/workingmyassof/freshform'

const CONTEXT = `You are a senior product designer + information architect rebuilding the information architecture of a live internal web app. Everything you need is on disk; read it before designing:

1. ${SP}/audit/owner-decisions.md — BINDING decisions and constraints from the owner, plus product facts. Read first. Design within them.
2. ${SP}/audit/digest2.txt — permissions, color, copy, data model, external research (with sources), student walkthrough. Read all of it.
3. /Users/workingmyassof/.claude/projects/-Users-workingmyassof-freshform/39d19c2b-ff94-4c22-a6f5-41fcc7f9a4fe/tool-results/bndnb44mn.txt — page-by-page inventory of all 33 routes and the components audit. Read all of it.
4. The repo at ${REPO}: PRODUCT.md, DESIGN.md, UX-IMPLEMENTATION-PROMPT.md, src/lib/nav.ts, src/components/app-shell.tsx, src/app/globals.css, prisma/schema.prisma. Open any page or component you need to see for real.

Your deliverable is ONE complete, opinionated IA proposal — not a list of options. Cover every role (platform admin, program admin, mentor, dual-role admin+mentor, dept leader, sales, student, and the signed-out pages), every one of the 33 routes (kept, merged, moved, or deleted — say which), the shell (desktop + mobile nav, utility cluster, how the Admin|Mentor switch is kept without duplicating pages), the settings architecture (program settings with a labelled gear; platform admin page for promoting mentors to program admins; personal settings), the shared primitive set the pages are built from (name each, what it replaces), the typed next-action/status model (every state, its severity, where it renders), the palette/token plan (within the decided 3-hue cut), the data/permission changes (ProgramAdmin grants; cut WebsiteFeedback; anything else you need), copy rules, and an implementation sequence in commit-sized steps. Every page shape must state its sections IN ORDER with a word budget for prose. Quote evidence from the audits (file:line) for the decisions you make. Be ruthless about noise: fewer containers, fewer hues, fewer words, one renderer per kind of thing, homes that read and do not edit.

Write your FULL proposal as Markdown to the file path given below (this is the artifact the judges read; make it complete — wireframe-level page specs in text, tables where useful, 3000-6000 words), and ALSO return the structured summary via the schema. The Markdown file is the primary deliverable; the schema is the index.`

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    thesis: { type: 'string', description: '2-4 sentences: the organising idea and why it fits this product' },
    markdownPath: { type: 'string' },
    shell: {
      type: 'object',
      properties: {
        desktopNav: { type: 'string' }, mobileNav: { type: 'string' }, utilityCluster: { type: 'string' },
        switchTreatment: { type: 'string', description: 'how the Admin|Mentor switch is kept and what it changes' },
        programContext: { type: 'string', description: 'how a user knows and changes which program they are looking at' },
      },
      required: ['desktopNav', 'mobileNav', 'utilityCluster', 'switchTreatment', 'programContext'],
    },
    sitemap: {
      type: 'array',
      items: { type: 'object', properties: { role: { type: 'string' }, destinations: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, route: { type: 'string' }, purpose: { type: 'string' } }, required: ['label', 'route', 'purpose'] } } }, required: ['role', 'destinations'] },
    },
    routeDispositions: {
      type: 'array', description: 'every one of the 33 existing routes',
      items: { type: 'object', properties: { route: { type: 'string' }, disposition: { type: 'string', enum: ['keep', 'reshape', 'merge-into', 'move-to', 'delete'] }, target: { type: 'string' }, why: { type: 'string' } }, required: ['route', 'disposition', 'target', 'why'] },
    },
    pages: {
      type: 'array', description: 'the pages of the NEW IA, each with ordered sections',
      items: {
        type: 'object',
        properties: {
          route: { type: 'string' }, roles: { type: 'array', items: { type: 'string' } }, coreQuestion: { type: 'string' },
          sections: { type: 'array', items: { type: 'object', properties: { order: { type: 'integer' }, name: { type: 'string' }, content: { type: 'string' }, proseBudgetWords: { type: 'integer' }, builtFrom: { type: 'string', description: 'existing component reused, or NEW primitive name' } }, required: ['order', 'name', 'content', 'proseBudgetWords', 'builtFrom'] } },
          mobile: { type: 'string', description: 'how it lays out on a phone' },
        },
        required: ['route', 'roles', 'coreQuestion', 'sections', 'mobile'],
      },
    },
    primitives: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, replaces: { type: 'array', items: { type: 'string' } }, api: { type: 'string' } }, required: ['name', 'replaces', 'api'] } },
    statusModel: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, label: { type: 'string' }, severity: { type: 'string', enum: ['neutral', 'ok', 'attention', 'problem'] }, kind: { type: 'string', enum: ['actionable', 'informational', 'blocked'] }, audience: { type: 'string' }, rendersIn: { type: 'string' } }, required: ['type', 'label', 'severity', 'kind', 'audience', 'rendersIn'] } },
    palette: { type: 'object', properties: { keep: { type: 'array', items: { type: 'string' } }, add: { type: 'array', items: { type: 'string' } }, retire: { type: 'array', items: { type: 'string' } }, rules: { type: 'array', items: { type: 'string' } } }, required: ['keep', 'add', 'retire', 'rules'] },
    dataAndPermissions: { type: 'array', items: { type: 'string' } },
    copyRules: { type: 'array', items: { type: 'string' } },
    implementationPhases: { type: 'array', items: { type: 'object', properties: { phase: { type: 'integer' }, goal: { type: 'string' }, steps: { type: 'array', items: { type: 'string' }, description: 'commit-sized steps' } }, required: ['phase', 'goal', 'steps'] } },
    tradeoffs: { type: 'array', items: { type: 'string' } },
    openQuestionsForOwner: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'thesis', 'markdownPath', 'shell', 'sitemap', 'routeDispositions', 'pages', 'primitives', 'statusModel', 'palette', 'dataAndPermissions', 'copyRules', 'implementationPhases', 'tradeoffs', 'openQuestionsForOwner'],
}

const ANGLES = [
  {
    key: 'inbox-first',
    brief: `ANGLE: INBOX-FIRST. The organising idea is triage. Every role home is a short, typed "needs you" list (Linear Inbox / GOV.UK task list) followed by one lead figure and a 7-day "up next" timeline; history and browsing live behind list destinations with server-side search, filters and pagination. Entity pages (student, mentor, program) are workspaces the inbox links into. Optimise for: the five-second rule, zero repeated numbers, homes that read and never edit, notifications and next-actions sharing one typed model. Be explicit about what a mentor sees on Monday morning in 3 lines.`,
  },
  {
    key: 'entity-first',
    brief: `ANGLE: ENTITY-FIRST. The organising idea is that Programs, Students and Mentors are the first-class objects and everything else is a tab or a row on one of them. Each entity gets ONE workspace page (header with pinned facts, main column of activity, side rail of facts + actions, tabs for depth), shared by every role that may see it, with controls gated by permission rather than by URL prefix — so the admin and mentor student pages become ONE page and the Admin|Mentor switch only changes the home and the nav, never the entity pages. Programs get Overview / Students / Mentors / Settings tabs with a labelled gear; the platform admin page promotes mentors to program admins. Optimise for: one renderer per kind of thing, no duplicate pages, edit-an-entity-on-its-own-page, taxonomy (task types, program archive) and settings that have exactly one address.`,
  },
  {
    key: 'calm-minimal',
    brief: `ANGLE: CALM-MINIMAL. The organising idea is subtraction. Cut routes, components, containers, hues and words until what is left is a quiet ledger: strong type hierarchy (one h1, one lead figure, hairlines not boxes), students get a consumer-grade three-tab phone app (Hours / Meetings / Book), mentors get a phone-friendly home built around "this week" and one big Log button, staff get dense honest tables with a filter bar and nothing decorative. Delete every gradient, watermark, island card, eyebrow-provenance sentence, per-panel tint and stat strip; collapse the 4 session renderers, 4 task renderers, 4 allocation renderers, 6 segmented controls, 8 confirm patterns, 13 input-class copies. Optimise for: fewest distinct things on screen, longest whitespace, copy under 12 words per hint, and a component inventory at least 40% smaller than today's 75. Keep the Admin|Mentor switch but make it nearly invisible (a quiet text toggle in the account menu + ⌥M).`,
  },
]

phase('Design')
const proposals = await parallel(ANGLES.map((a) => () =>
  agent(`${CONTEXT}\n\n${a.brief}\n\nWrite your Markdown proposal to: ${SP}/design/proposal-${a.key}.md (create the directory). Set markdownPath to that path in your structured return.`, { label: `architect:${a.key}`, phase: 'Design', schema: SCHEMA }).then((r) => r && { angle: a.key, ...r })
))

const done = proposals.filter(Boolean)
log(`proposals: ${done.map((p) => p.angle).join(', ')}`)
return { proposals: done }