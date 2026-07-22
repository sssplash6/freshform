# freshlog user guides

Simple, one-role-per-file instruction sheets (PDF):

- **student-guide.pdf** — signing in, reading your hours, deadlines, booking, no-shows.
- **mentor-guide.pdf** — signing in, booking links, logging sessions (incl. no-shows), deadlines, corrections.
- **admin-guide.pdf** — dashboard, students, allocating hours (deadlines + Master's amount paid), mentors, the admin/mentor toggle, reading the stats.

## Regenerating

The PDFs are built from `generate-guides.cjs` with [pdfkit](https://pdfkit.org/) (pure JS, no browser). Edit the content in that file, then:

```bash
# in a scratch dir (pdfkit is not a project dependency)
npm init -y && npm install pdfkit
node /path/to/repo/docs/guides/generate-guides.cjs /path/to/repo/docs/guides
```

Keep the wording in step with the app when behaviour changes.
