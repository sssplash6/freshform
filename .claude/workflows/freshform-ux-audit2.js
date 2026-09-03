export const meta = {
  name: 'freshform-ux-audit',
  description: 'Exhaustive audit of the freshform app: every page, component, permission, color, copy block, and rendered walkthroughs per role, plus external IA research, then a completeness critic',
  phases: [
    { title: 'Inventory', detail: 'one reader per role area, every route' },
    { title: 'Cross-cutting', detail: 'components, permissions, color, copy, data model, external research' },
    { title: 'Walkthrough', detail: 'rendered pages as student / mentor / admin' },
    { title: 'Critique', detail: 'completeness critic over everything' },
  ],
}

const REPO = '/Users/workingmyassof/freshform'
const BASE = 'http://localhost:3001'

const CONTEXT = `
You are auditing a live internal web app for a UX reorganisation. Repo: ${REPO} (Next.js 16 App Router, React 19, Prisma 7 + SQLite, Auth.js v5, Tailwind 4). Read ONLY under ${REPO}; ignore node_modules and src/generated.

Product: "freshform" / freshlog.net — Freshman Academy's mentoring-hours ledger. Five roles: ADMIN (cross-program ops), DEPT_LEADER and SALES (scoped to one program), MENTOR (@freshman.academy staff who log sessions, schedule interviews, set booking links), STUDENT (external clients checking remaining hours, confirming interviews, booking, leaving feedback). ADMINs may carry isMentor=true (dual role) and toggle between /admin and /mentor via a profile switch. Read ${REPO}/PRODUCT.md, ${REPO}/DESIGN.md, ${REPO}/README.md, ${REPO}/TODO.md and ${REPO}/UX-IMPLEMENTATION-PROMPT.md first for the intended design language and the requested upgrade.

The owner's complaints, verbatim: "repetitions, text blocks, long text not rendering right, too much noise, zero proper categorization and management of assets, too clowny because it uses too many colors", "everything feels all over the place. like why mentor sees bunch of nonsense when on the homepage. or why we don't have separate settings icon and page for programs. also, admins and mentors should be aligned: if a mentor is admin, they should be admin of programs they mentor in." Decisions already made: semantic color stays (orange = hours/progress, blue = actions/chrome, red = overdrawn/destructive); the 8 person/program identity hues will be cut to 3 muted ones; amber "log" / violet "plan" panel tints go, keeping at most a hairline rule. Goal: a super clean platform with no noise, everything organised.

Be concrete and exhaustive: cite file paths and line numbers, quote the actual copy, count things. Read whole files, do not skim. Your final output is data for an orchestrator, not prose for a human — fill the schema completely; prefer more items over fewer.
`

const SECTION = {
  type: 'object',
  properties: {
    order: { type: 'integer' },
    label: { type: 'string', description: 'heading/eyebrow or a 3-6 word description' },
    components: { type: 'array', items: { type: 'string' } },
    dataShown: { type: 'string' },
    actions: { type: 'array', items: { type: 'string' }, description: 'buttons/forms/links that mutate or navigate' },
    proseWords: { type: 'integer', description: 'approx words of explanatory prose in this section (not data)' },
    verdict: { type: 'string', enum: ['keep', 'shrink', 'move', 'merge', 'cut'] },
    verdictWhy: { type: 'string' },
    moveTo: { type: 'string', description: 'if move/merge: the route or component it belongs in' },
  },
  required: ['order', 'label', 'components', 'dataShown', 'actions', 'proseWords', 'verdict', 'verdictWhy'],
}

const PAGE_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          route: { type: 'string' },
          file: { type: 'string' },
          role: { type: 'string' },
          coreQuestion: { type: 'string', description: 'the one question a user opens this page to answer' },
          answersCoreQuestionWhere: { type: 'string', enum: ['first-screen', 'after-scroll', 'nowhere'] },
          sections: { type: 'array', items: SECTION },
          inlineStates: {
            type: 'array',
            description: 'every place the page derives a status/label/color inline (e.g. remaining < 0 → red, status===PROPOSED → amber chip). These become a shared typed next-action model.',
            items: {
              type: 'object',
              properties: {
                fileLine: { type: 'string' },
                expression: { type: 'string' },
                meaning: { type: 'string' },
                presentation: { type: 'string', description: 'label text + color/chip used' },
              },
              required: ['fileLine', 'expression', 'meaning', 'presentation'],
            },
          },
          hues: { type: 'array', items: { type: 'string' }, description: 'distinct hue families visible: brand-blue, orange, red, green, amber, violet, person-tones, program-tones, gray, other' },
          longTextRisks: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, why: { type: 'string' } }, required: ['where', 'why'] } },
          repetition: { type: 'array', items: { type: 'string' }, description: 'things repeated within the page or duplicated from other pages (say which)' },
          queriesCount: { type: 'integer', description: 'number of prisma/query calls the page makes' },
          firstFiveSeconds: { type: 'string', description: 'what a user sees first vs what they need first' },
          proposedShape: { type: 'string', description: 'in 3-6 lines: what this page should contain, in order, after the reorganisation — or whether it should exist' },
        },
        required: ['route', 'file', 'role', 'coreQuestion', 'answersCoreQuestionWhere', 'sections', 'inlineStates', 'hues', 'longTextRisks', 'repetition', 'queriesCount', 'firstFiveSeconds', 'proposedShape'],
      },
    },
    crossPageNotes: { type: 'array', items: { type: 'string' } },
  },
  required: ['pages', 'crossPageNotes'],
}

const inventoryPrompt = (area, routes, extra) => `${CONTEXT}

TASK: inventory the ${area} pages. Routes and files:
${routes.map((r) => `- ${r}`).join('\n')}
${extra || ''}
For every route: read the page file fully, then read EVERY component it imports from ${REPO}/src/components (follow imports one level down, including forms). Fill the schema for each route. Count prose words honestly. In "inlineStates" list every conditional that turns data into a label, chip, tone, or colored text. In "repetition" name the specific duplicate (e.g. "the 3-number Students/Hrs done/Hrs left card appears here and on /admin as ProgramIslandCard"). In "proposedShape" be opinionated: what would a ruthless information architect keep on this page, and where would the rest go.`

const COMPONENTS_SCHEMA = {
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          name: { type: 'string' },
          purpose: { type: 'string' },
          usedIn: { type: 'array', items: { type: 'string' } },
          overlapsWith: { type: 'array', items: { type: 'string' } },
          overlapWhy: { type: 'string' },
          rawColorClasses: { type: 'array', items: { type: 'string' }, description: 'Tailwind color classes that are NOT semantic tokens, e.g. text-amber-700, bg-green-50' },
          tokenHues: { type: 'array', items: { type: 'string' } },
          verdict: { type: 'string', enum: ['keep', 'merge', 'cut', 'refactor'] },
          verdictWhy: { type: 'string' },
        },
        required: ['file', 'name', 'purpose', 'usedIn', 'overlapsWith', 'overlapWhy', 'rawColorClasses', 'tokenHues', 'verdict', 'verdictWhy'],
      },
    },
    clusters: {
      type: 'array',
      description: 'groups of components that show the same kind of thing different ways (e.g. five ways of listing sessions)',
      items: { type: 'object', properties: { theme: { type: 'string' }, members: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } }, required: ['theme', 'members', 'recommendation'] },
    },
    missingPrimitives: { type: 'array', items: { type: 'string' }, description: 'shared primitives the app needs but lacks (status chip model, save-state indicator, timeline item, filter bar, etc.)' },
  },
  required: ['components', 'clusters', 'missingPrimitives'],
}

const PERMISSIONS_SCHEMA = {
  type: 'object',
  properties: {
    gates: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, rule: { type: 'string' } }, required: ['where', 'rule'] } },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          name: { type: 'string' },
          whatItDoes: { type: 'string' },
          allowedRoles: { type: 'array', items: { type: 'string' } },
          scopeCheck: { type: 'string', description: 'how program/ownership scope is enforced, or "none"' },
          notifies: { type: 'array', items: { type: 'string' } },
        },
        required: ['file', 'name', 'whatItDoes', 'allowedRoles', 'scopeCheck', 'notifies'],
      },
    },
    adminScope: {
      type: 'object',
      properties: {
        howAdminIsGated: { type: 'string' },
        howLeaderSalesScopeWorks: { type: 'string' },
        programScopedAdminDesign: { type: 'string', description: 'concrete design: how "an admin who mentors is admin of the programs they mentor in" could work — data model, gates, UI' },
        filesToChange: { type: 'array', items: { type: 'string' } },
        risks: { type: 'array', items: { type: 'string' } },
        openQuestionsForOwner: { type: 'array', items: { type: 'string' } },
      },
      required: ['howAdminIsGated', 'howLeaderSalesScopeWorks', 'programScopedAdminDesign', 'filesToChange', 'risks', 'openQuestionsForOwner'],
    },
    dualRole: { type: 'object', properties: { current: { type: 'string' }, gaps: { type: 'array', items: { type: 'string' } }, unifiedWorkspaceDesign: { type: 'string', description: 'what a single merged admin+mentor experience could look like instead of a toggle' } }, required: ['current', 'gaps', 'unifiedWorkspaceDesign'] },
  },
  required: ['gates', 'actions', 'adminScope', 'dualRole'],
}

const COLOR_SCHEMA = {
  type: 'object',
  properties: {
    tokens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, fileCount: { type: 'integer' }, purpose: { type: 'string' } }, required: ['name', 'value', 'fileCount', 'purpose'] } },
    rawColorClasses: { type: 'array', description: 'every non-token Tailwind color class in src (text-amber-700, bg-green-50, border-red-200, ...) with counts and files', items: { type: 'object', properties: { cls: { type: 'string' }, count: { type: 'integer' }, files: { type: 'array', items: { type: 'string' } } }, required: ['cls', 'count', 'files'] } },
    huesPerRoute: { type: 'array', items: { type: 'object', properties: { route: { type: 'string' }, hues: { type: 'array', items: { type: 'string' } } }, required: ['route', 'hues'] } },
    worstOffenders: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, why: { type: 'string' } }, required: ['file', 'why'] } },
    proposal: {
      type: 'object',
      properties: {
        keep: { type: 'array', items: { type: 'string' } },
        retire: { type: 'array', items: { type: 'string' } },
        semanticStatusScale: { type: 'string', description: 'how to express ok / attention / problem / neutral with the fewest hues while never relying on color alone' },
        threeIdentityHues: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, soft: { type: 'string' }, ink: { type: 'string' }, dot: { type: 'string' }, why: { type: 'string' } }, required: ['name', 'soft', 'ink', 'dot', 'why'] }, description: 'three low-saturation hues that read apart from brand blue, orange and red, with hex values and AA contrast noted' },
        migrationSteps: { type: 'array', items: { type: 'string' } },
      },
      required: ['keep', 'retire', 'semanticStatusScale', 'threeIdentityHues', 'migrationSteps'],
    },
  },
  required: ['tokens', 'rawColorClasses', 'huesPerRoute', 'worstOffenders', 'proposal'],
}

const COPY_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'array',
      description: 'every prose block of roughly 18+ words in src/app and src/components (JSX text, subtitle/emptyBody/hint props, callout bodies)',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          words: { type: 'integer' },
          text: { type: 'string', description: 'first ~140 chars' },
          kind: { type: 'string', enum: ['explainer', 'empty-state', 'callout', 'subtitle', 'hint', 'error', 'success', 'other'] },
          verdict: { type: 'string', enum: ['keep', 'shorten', 'cut', 'move-to-tooltip', 'move-to-help'] },
          rewrite: { type: 'string', description: 'proposed replacement, or empty' },
        },
        required: ['file', 'line', 'words', 'text', 'kind', 'verdict', 'rewrite'],
      },
    },
    repeatedPhrases: { type: 'array', items: { type: 'object', properties: { phrase: { type: 'string' }, count: { type: 'integer' }, files: { type: 'array', items: { type: 'string' } } }, required: ['phrase', 'count', 'files'] } },
    grammarBugs: { type: 'array', items: { type: 'string' }, description: 'e.g. "your time appear", "time are all used up"' },
    toneNotes: { type: 'array', items: { type: 'string' } },
    vocabularyDrift: { type: 'array', items: { type: 'string' }, description: 'same concept, different words (hours/time/minutes; interview/meeting/session; task/goal/assignment)' },
  },
  required: ['blocks', 'repeatedPhrases', 'grammarBugs', 'toneNotes', 'vocabularyDrift'],
}

const DATA_SCHEMA = {
  type: 'object',
  properties: {
    entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, purpose: { type: 'string' }, statuses: { type: 'array', items: { type: 'string' } }, managedAt: { type: 'array', items: { type: 'string' }, description: 'routes where it is created/edited' }, viewedAt: { type: 'array', items: { type: 'string' } } }, required: ['name', 'purpose', 'statuses', 'managedAt', 'viewedAt'] } },
    taxonomyGaps: { type: 'array', items: { type: 'object', properties: { entity: { type: 'string' }, gap: { type: 'string' }, proposal: { type: 'string' } }, required: ['entity', 'gap', 'proposal'] } },
    notificationTypes: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, audience: { type: 'string' }, proposedCategory: { type: 'string' } }, required: ['type', 'audience', 'proposedCategory'] } },
    settingsCandidates: { type: 'array', description: 'everything that is configuration rather than daily work, where it lives today, and where it should live', items: { type: 'object', properties: { item: { type: 'string' }, today: { type: 'string' }, belongsIn: { type: 'string' } }, required: ['item', 'today', 'belongsIn'] } },
    avatarAndBrandAssets: { type: 'string', description: 'how avatars, monograms, icons, logo are handled today and what a managed approach looks like' },
    schemaChangesNeeded: { type: 'array', items: { type: 'string' }, description: 'for taxonomy, settings, program-scoped admin, notification categories — with migration notes' },
  },
  required: ['entities', 'taxonomyGaps', 'notificationTypes', 'settingsCandidates', 'avatarAndBrandAssets', 'schemaChangesNeeded'],
}

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    patterns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, whatItIs: { type: 'string' }, whenItFits: { type: 'string' }, examples: { type: 'array', items: { type: 'string' } }, fitForFreshform: { type: 'string', enum: ['strong', 'partial', 'poor'] }, why: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['name', 'whatItIs', 'whenItFits', 'examples', 'fitForFreshform', 'why', 'sources'] } },
    navigationRecommendation: { type: 'string', description: 'sidebar vs top bar vs hybrid for a 5-role tool with 3-8 destinations per role, desktop-first staff and mobile students, with reasoning and sources' },
    settingsPlacement: { type: 'string' },
    dashboardPrinciples: { type: 'array', items: { type: 'string' } },
    multiRoleAccountPatterns: { type: 'array', items: { type: 'string' }, description: 'how products handle one person with two roles (toggle vs unified vs scoped)' },
    densityAndColor: { type: 'array', items: { type: 'string' } },
    antiPatternsToAvoid: { type: 'array', items: { type: 'string' } },
  },
  required: ['patterns', 'navigationRecommendation', 'settingsPlacement', 'dashboardPrinciples', 'multiRoleAccountPatterns', 'densityAndColor', 'antiPatternsToAvoid'],
}

const WALK_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          route: { type: 'string' },
          status: { type: 'integer' },
          visibleTextOrder: { type: 'array', items: { type: 'string' }, description: 'the first ~40 visible text nodes in DOM order (after nav)' },
          sectionsInOrder: { type: 'array', items: { type: 'string' } },
          totalWords: { type: 'integer' },
          headingCount: { type: 'integer' },
          interactiveCount: { type: 'integer', description: 'buttons + links + inputs' },
          coreQuestion: { type: 'string' },
          answeredWhere: { type: 'string', enum: ['immediately', 'after-scroll', 'hunt', 'never'] },
          noise: { type: 'array', items: { type: 'string' }, description: 'things on the page this role does not need right now' },
          missing: { type: 'array', items: { type: 'string' } },
          brokenOrOdd: { type: 'array', items: { type: 'string' }, description: 'grammar, truncation, overflow, wrong plural, empty cells, etc.' },
        },
        required: ['route', 'status', 'visibleTextOrder', 'sectionsInOrder', 'totalWords', 'headingCount', 'interactiveCount', 'coreQuestion', 'answeredWhere', 'noise', 'missing', 'brokenOrOdd'],
      },
    },
    mondayMorningStory: { type: 'string', description: 'narrate this role opening the app on Monday: what they try to do, how many clicks/scrolls, where they get lost' },
    topFixes: { type: 'array', items: { type: 'string' } },
  },
  required: ['role', 'pages', 'mondayMorningStory', 'topFixes'],
}

const walkPrompt = (role, token, routes, persona) => `${CONTEXT}

TASK: walk the RENDERED app as a ${role}. A production server is running at ${BASE}. Authenticate by sending the cookie header exactly: Cookie: authjs.session-token=${token}
Persona: ${persona}

Fetch each route with curl (e.g. curl -s -H "Cookie: authjs.session-token=..." ${BASE}/route) and extract visible text in DOM order. Use this Python to strip markup:
python3 - <<'EOF'
import re,html,sys
s=open('page.html').read()
s=re.sub(r"<(script|style)[^>]*>.*?</\\1>"," ",s,flags=re.S)
t=html.unescape(re.sub(r"<[^>]+>","\\n",s))
print("\\n".join(l.strip() for l in t.split("\\n") if l.strip()))
EOF
Also count headings (<h1>-<h3>), and interactive elements (<a , <button, <input, <select, <textarea) from the raw HTML. Routes to visit:
${routes.map((r) => `- ${r}`).join('\n')}
Follow links to at least one detail page (a student, a mentor, a session list) when the role has them. Report honestly what is on screen and in what order. Do NOT submit any forms or mutate anything — GET only. Save fetched HTML under /private/tmp/claude-501/-Users-workingmyassof-freshform/39d19c2b-ff94-4c22-a6f5-41fcc7f9a4fe/scratchpad/walk-${role}/ .`

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    contradictions: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' }, description: 'routes, components, or concerns nobody covered' },
    prioritizedFindings: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, evidence: { type: 'string' }, impact: { type: 'string', enum: ['high', 'medium', 'low'] }, area: { type: 'string' } }, required: ['finding', 'evidence', 'impact', 'area'] } },
    questionsForOwner: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, whyItMatters: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } }, required: ['question', 'whyItMatters', 'options', 'recommendation'] } },
    proposedSitemapSeeds: { type: 'array', items: { type: 'string' }, description: 'candidate top-level destinations per role, distilled from the inventories' },
  },
  required: ['contradictions', 'gaps', 'prioritizedFindings', 'questionsForOwner', 'proposedSitemapSeeds'],
}

const T = args.tokens

phase('Inventory')
const inventoryJobs = [
  ['admin core', ['/admin → src/app/admin/page.tsx', '/admin/students → src/app/admin/students/page.tsx', '/admin/students/[id] → src/app/admin/students/[id]/page.tsx', '/admin/feedback → src/app/admin/feedback/page.tsx'], 'Pay special attention to LedgerBoard, StudentsTable, allocation/assignment/session row-action forms, and how many distinct ways a session or task is rendered.'],
  ['admin programs & mentors', ['/admin/mentors → src/app/admin/mentors/page.tsx', '/admin/mentors/[id] → src/app/admin/mentors/[id]/page.tsx', '/admin/programs/[id] → src/app/admin/programs/[id]/page.tsx', '/admin/programs/[id]/settings → src/app/admin/programs/[id]/settings/page.tsx', '/admin/programs/[id]/students → src/app/admin/programs/[id]/students/page.tsx', '/mentors/[id] (public mentor profile) → src/app/mentors/[id]/page.tsx'], 'The owner asked why there is no separate settings icon/page for programs — describe exactly what program configuration exists today and where it is scattered.'],
  ['mentor', ['/mentor → src/app/mentor/page.tsx', '/mentor/sessions → src/app/mentor/sessions/page.tsx', '/mentor/students/[id] → src/app/mentor/students/[id]/page.tsx', '/mentor/feedback → src/app/mentor/feedback/page.tsx', '/mentor/onboarding → src/app/mentor/onboarding/page.tsx'], 'The owner said "why does a mentor see a bunch of nonsense on the homepage" — be precise about what is there, in order, and what a mentor actually needs on a Monday.'],
  ['student', ['/student → src/app/student/page.tsx', '/student/book → src/app/student/book/page.tsx', '/student/feedback → src/app/student/feedback/page.tsx', '/student/onboarding → src/app/student/onboarding/page.tsx'], 'Students are external clients; the page must feel approachable. Note every grammar slip ("your time appear").'],
  ['leader, sales & shared chrome', ['/leader → src/app/leader/page.tsx', '/leader/students → src/app/leader/students/page.tsx', '/leader/feedback → src/app/leader/feedback/page.tsx', '/sales → src/app/sales/page.tsx', '/sales/students → src/app/sales/students/page.tsx', '/notifications → src/app/notifications/page.tsx', '/login → src/app/login/page.tsx', '/unsubscribe → src/app/unsubscribe/page.tsx', 'shell → src/components/app-shell.tsx, src/components/nav-links.tsx, src/components/profile-switch.tsx, src/lib/nav.ts, src/app/layout.tsx, src/app/page.tsx, src/app/error.tsx, src/app/loading.tsx'], 'Describe the navigation model precisely: what each role sees in the bar, how the dual-role switch works, where notifications and account live, and what is missing (settings, search, program switcher).'],
]

phase('Cross-cutting')
const crossJobs = [
  ['components', `${CONTEXT}\n\nTASK: audit EVERY file in ${REPO}/src/components (including ui/ and forms/). For each: purpose, where it is used (grep src/app and src/components), what it overlaps with, raw (non-token) Tailwind color classes it uses, verdict. Then name clusters: e.g. all the ways sessions/meetings are listed (MeetingsLog, StudentJourney, ScheduledMeetings, LedgerBoard, StudentLedger, mentor-hours-list...), all the ways a number strip is shown, all the ways a person is rendered. Finally list the shared primitives the requested upgrade needs that do not exist (typed status/next-action chip, save-state indicator, timeline row, filter bar, section header with count, settings row...).`, COMPONENTS_SCHEMA],
  ['permissions', `${CONTEXT}\n\nTASK: audit the permission model. Read ${REPO}/src/lib/dal.ts, ${REPO}/src/lib/auth.ts, ${REPO}/src/proxy.ts, every layout.tsx under src/app, ${REPO}/src/lib/constants.ts, and EVERY file in ${REPO}/src/lib/actions. For each server action: what it does, who may call it, how scope is checked. Then design, concretely, how "an ADMIN who mentors is admin of the programs they mentor in" could work: is ADMIN today global? Would a program-scoped admin be a new role, a flag, or derived from MentorAssignment? What would leader/sales become? Which files change? What breaks? Also assess the dual-role toggle (profile-switch) vs a unified workspace where one person sees admin controls inside their mentor pages. List the questions only the owner can answer.`, PERMISSIONS_SCHEMA],
  ['color', `${CONTEXT}\n\nTASK: audit color. Read ${REPO}/src/app/globals.css, ${REPO}/src/lib/person-tone.ts, ${REPO}/src/components/chip.tsx, ${REPO}/src/components/ui/callout.tsx, ${REPO}/src/components/ui/panel.tsx, ${REPO}/src/components/stat-card.tsx, ${REPO}/src/components/ui/page-header.tsx. Then grep ALL of src (excluding src/generated) for every Tailwind color class: token ones (brand, accent, ink, muted-fg, line, canvas, surface, log-*, plan-*, tone-*) AND raw ones (text-amber-700, bg-green-50, border-red-200, text-green-700, bg-amber-50, etc.). Count and list files. Compute hues visible per route by reading each page and its components. Then PROPOSE: which tokens stay, which retire, how status (ok / needs attention / problem / neutral) is expressed with the fewest hues and never color alone (icon/shape/text), and three concrete muted identity hues (hex for soft/ink/dot) that read apart from brand blue #124b84, orange #f18d05 and red — check ink-on-soft contrast is at least 4.5:1 and say the ratio. Give migration steps.`, COLOR_SCHEMA],
  ['copy', `${CONTEXT}\n\nTASK: audit copy. Read every file in ${REPO}/src/app (pages, layouts, error) and ${REPO}/src/components. Extract EVERY prose block of about 18+ words: JSX text, subtitle=, emptyBody=, hint, caption, callout bodies, form helper text, toasts. For each give file, line, word count, the text, kind, verdict, and a tighter rewrite when shortening. Find repeated phrases across files ("Talk to your program contact", "appears here once", "An admin ..."). List grammar bugs (e.g. "There's one step left before your time appear", "Your mentoring time are all used up"). Note vocabulary drift: hours vs time vs minutes; interview vs meeting vs session vs diary; task vs goal vs assignment; allocation vs allotment vs grant. Judge tone against PRODUCT.md (warm, exact, never bureaucratic).`, COPY_SCHEMA],
  ['data model & taxonomy', `${CONTEXT}\n\nTASK: audit the data model and where each entity is managed. Read ${REPO}/prisma/schema.prisma, ${REPO}/config/app-config.ts, ${REPO}/src/lib/constants.ts, ${REPO}/src/lib/notify.ts, ${REPO}/src/lib/tasks.ts, ${REPO}/src/lib/avatar.ts, ${REPO}/src/app/api/avatar/[id]/route.ts, ${REPO}/src/components/avatar.tsx, ${REPO}/src/components/person-chip.tsx, ${REPO}/src/components/icons.tsx, and the pages that create/edit each entity (grep for the server actions). For each entity: purpose, statuses, where created/edited, where viewed. Name taxonomy gaps (tasks are free-text purposes off TASK_PRESETS with no category; programs have no archive/active state; no cohort management surface; notifications have 17 flat types). Propose notification categories for a student-readable notification center. List everything that is configuration rather than daily work (programs, cohorts, task presets, staff list, booking links, email prefs, profile, avatar) with where it lives today and where it belongs (a Settings area with sub-pages? per-program settings? account menu?). Describe avatar/monogram/icon handling and what a managed approach looks like. List schema changes needed with migration notes.`, DATA_SCHEMA],
  ['external research', `${CONTEXT}\n\nTASK: research (WebSearch/WebFetch) what information architecture suits a small multi-role internal operations tool like this: ~10 staff on desktop a few times a week, ~50-300 students on phones, five roles, one person sometimes holding two roles. Investigate with sources: (1) sidebar vs top-bar vs hybrid navigation for 3-8 destinations per role; (2) where settings belong (global settings page vs per-entity settings vs account menu) and the "settings gear" convention; (3) role-based home/dashboard design principles — "what needs my attention" first, next-action lists, avoiding stat-tile grids; (4) how products handle multi-role accounts (workspace switcher like Slack/Notion, role toggle like Airbnb host/guest, unified permissions like GitHub org roles); (5) command-center / entity-workspace patterns (Linear issue view, Notion page, Intercom conversation) for a student relationship page; (6) color and density guidance for ledgers/admin tools (Stripe, Linear, Mercury, Basecamp) — how few hues they use and how they encode status without color alone; (7) anti-patterns. Cite URLs. Judge fit for freshform explicitly and recommend.`, RESEARCH_SCHEMA],
]

phase('Walkthrough')
const walkJobs = [
  ['student', T.student, ['/student', '/student/book', '/student/feedback', '/notifications'], 'Aziza Yusupova, a Master\'s Program student with 13 logged sessions, 8 tasks and 2 scheduled interviews. She opens the app to see how much time she has left and when she is meeting someone.'],
  ['mentor', T.mentor, ['/mentor', '/mentor/sessions', '/mentor/feedback', '/notifications', 'then one /mentor/students/[id] linked from /mentor'], 'Tyler, a plain MENTOR assigned to the Master\'s Program. He opens the app on Monday to see who he is meeting this week, log last week\'s sessions, and check which students are running low.'],
  ['admin', T.admin, ['/admin', '/admin/students', '/admin/mentors', '/admin/feedback', '/mentor (the dual-role toggle target)', '/notifications', 'then one /admin/students/[id] with many sessions (Aziza: /admin/students/demo-sp-1), one /admin/programs/[id] linked from /admin, and its /settings'], 'tech@freshman.academy, an ADMIN who also mentors (isMentor=true). Opens the app to see who needs approval, who is low on hours, what was logged this week, and to toggle into the mentor view.'],
]

const [inventories, crosses, walks] = await Promise.all([
  parallel(inventoryJobs.map(([area, routes, extra]) => () => agent(inventoryPrompt(area, routes, extra), { label: `inventory:${area}`, phase: 'Inventory', schema: PAGE_SCHEMA }).then((r) => ({ area, ...r })))),
  parallel(crossJobs.map(([name, prompt, schema]) => () => agent(prompt, { label: `audit:${name}`, phase: 'Cross-cutting', schema }).then((r) => ({ name, result: r })))),
  parallel(walkJobs.map(([role, token, routes, persona]) => () => agent(walkPrompt(role, token, routes, persona), { label: `walk:${role}`, phase: 'Walkthrough', schema: WALK_SCHEMA }))),
])

const inv = inventories.filter(Boolean)
const cross = crosses.filter(Boolean)
const walk = walks.filter(Boolean)
log(`inventories ${inv.length}/${inventoryJobs.length}, cross-cutting ${cross.length}/${crossJobs.length}, walkthroughs ${walk.length}/${walkJobs.length}`)

phase('Critique')
const digest = JSON.stringify({ inventories: inv, crossCutting: cross, walkthroughs: walk })
const critic = await agent(`${CONTEXT}

TASK: you are the completeness critic. Below is the combined output of ${inv.length + cross.length + walk.length} audit agents. Read it all, then (1) list contradictions between agents; (2) list gaps — any route under ${REPO}/src/app (run: find ${REPO}/src/app -name 'page.tsx') or component under ${REPO}/src/components nobody covered, or any owner complaint no finding addresses; (3) produce a prioritized list of findings with evidence and impact; (4) write the questions ONLY THE OWNER can answer, each with why it matters, 2-4 options, and your recommendation — cover at least: admin/mentor alignment semantics, what a mentor's home should contain, settings scope, what to cut entirely (website feedback? mentor ratings? weekly digest? program islands?), navigation shape, mobile priority per role, deploy safety while redesigning (every push to main auto-deploys to freshlog.net); (5) seed a sitemap: candidate top-level destinations per role.

AUDIT OUTPUT:
${digest}`, { label: 'critic', phase: 'Critique', schema: CRITIC_SCHEMA, effort: 'max' })

return { inventories: inv, crossCutting: cross, walkthroughs: walk, critic }