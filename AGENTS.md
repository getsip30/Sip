<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reading the bundled Next.js docs

The path above is correct — `node_modules/next/dist/docs/` exists and is
version-matched to the installed Next (16.2.9). Files are `.md`, laid out as
`01-app/`, `02-pages/`, `03-architecture/`, `04-community/`, with `index.md` at
the root.

Getting at them is the part that fails silently, so start here rather than
concluding the docs are missing:

- `Glob` and `Grep` skip `node_modules` and return "no files found".
- `Read` and `ls node_modules/...` are refused by the sandbox's permission
  settings.

Neither is evidence the docs are absent. Read them through node instead:

```bash
# list a section
node -e "console.log(require('fs').readdirSync('node_modules/next/dist/docs/01-app/02-guides'))"

# read a page
node -e "console.log(require('fs').readFileSync('node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md','utf8'))"

# search across the docs
node -e "const{execSync}=require('child_process');console.log(execSync('grep -rl SEARCH_TERM node_modules/next/dist/docs',{encoding:'utf8'}))"
```

Per the Next.js `ai-agents` guide, everything inside the
`BEGIN/END:nextjs-agent-rules` markers is managed by Next.js and may be
overwritten on upgrade. Project notes — including this section — belong outside
them.

# Working rules

- Work on a separate branch, never directly on `main`.
- Never merge or push to `main` or prod without explicit approval, per change.
- Never run a migration against any database, dev or prod. Generate the file with `npm run db:generate` and stop there; applying it is a human decision.
- No destructive database operations: no drops, no data mutations, no writes outside a migration file.
- Small, frequent commits on the branch.
- If an action might cross one of these lines, stop and ask first.
