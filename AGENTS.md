<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Gate every page, not just its layout

Next renders a layout and its page **in parallel**. A redirect thrown by a
layout does not stop the page beneath it from running its queries and
streaming the result — so a gate that lives only in the layout is not a gate.

Until 3 September 2026 a request carrying any non-empty session cookie —
expired, signed with a rotated secret, or plain garbage — got HTTP 200, a
redirect to `/login`, and the entire student roster with their email addresses
in the payload.

So: every page function calls its own gate, on its first line, before any
query. `getCurrentUser` is request-cached, so the second call is free.

The gates live in `src/lib/dal.ts` (`requireUser`, `requireStaff`,
`requireAdminAccess`, `requireProgramScope`, `requireMentor`); the questions
they ask live in `src/lib/authz.ts`. A gate that has to load a row before it
can decide — "is this student in a program I administer?" — fetches the row
first and gates second, and answers "not yours" and "does not exist"
identically, so the error cannot be used to enumerate what exists.
