# "Report a problem" form for client sites

Files to copy into `github.com/StickySites/site-template` (not edited there from this repo):

- `ReportProblemForm.tsx` goes into the template's components folder, used on a `/report-a-problem` page.
- `api-route/route.ts` becomes `app/api/report-problem/route.ts`.

Per site: create a **tickets:intake** key in the CRM (Settings → API keys), choose that site,
and set `STICKY_CRM_URL` and `STICKY_TICKET_KEY` in the site's hosting environment. The key
can only create tickets for that one site. Update `ops/sops/SOP-06-WEBSITE-BUILD.md` to add
the form and key to the site build checklist (`ops` is a separate repo, so that edit is not
part of this branch). The CRM rate-limits per key and per visitor IP and, if
`TURNSTILE_SECRET_KEY` is set there, requires a valid Turnstile token.
