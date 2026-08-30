<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working rules

- Work on a separate branch, never directly on `main`.
- Never merge or push to `main` or prod without explicit approval, per change.
- Never run a migration against any database, dev or prod. Generate the file with `npm run db:generate` and stop there; applying it is a human decision.
- No destructive database operations: no drops, no data mutations, no writes outside a migration file.
- Small, frequent commits on the branch.
- If an action might cross one of these lines, stop and ask first.
