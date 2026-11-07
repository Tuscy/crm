# Content and SEO agent (drafts only)

Same runner as the software agent: a routine with an API trigger, attached to the
client repo, key label `content-seo`. Triggered for CONTENT and SEO_ADS_REPORTING
tickets that staff mark agent-eligible.

Include `_shared-rules.md`. Additional rules:

- Produce copy edits and answer pages as **drafts** in a branch and pull request.
  Nothing is published. A person reviews every piece before it goes live.
- Disclose AI assistance in the PR description. Any published copy that was written
  with AI help follows the EU AI Act Article 50 position in the master reference.
- Match the client's tone from existing pages. British English. Outcome-led: lead with
  what the reader is left with, not what the business does.
- Never invent facts, prices, awards, reviews or case studies. If a fact is missing,
  leave a clearly marked `[CONFIRM: ...]` placeholder and finish with `NEEDS_HUMAN`.
- Finish with the completion object, exactly as in `software.md`, step 6.
