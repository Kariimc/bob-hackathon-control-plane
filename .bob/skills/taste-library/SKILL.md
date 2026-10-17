---
name: taste-library
description: >-
  Persistent curated corpus of AAA visual references, technique extractions,
  and design patterns. Query it before starting any visual work to get vetted
  references instantly. Add to it after every Phase 1 reference pull so the
  library grows richer with every task. Use when the user says: find references,
  pull inspiration, what are good examples of, taste library, add to library,
  curate references, or before any visual-quality-gate Phase 1 pull.
---

# Taste Library

A persistent, growing corpus of vetted AAA visual references and extracted
design patterns. Lives at `.bob/skills/taste-library/library.json`.

Every entry is a fully distilled reference — not just a URL, but the extracted
layout pattern, type system, color logic, motion signature, and technique notes
that make it worth citing. Agents never start cold.

---

## Commands

### QUERY — find references for a task

```
/taste query <brief>
```

Examples:
- `/taste query dark editorial SaaS with strong typography`
- `/taste query 3D hero section real-time WebGL`
- `/taste query mobile game UI with sci-fi aesthetic`

**Query protocol:**
1. Read `library.json` using `read_file`.
2. Score every entry against the brief across 5 dimensions:
   - `domain` match (exact: 3pts, adjacent: 1pt, miss: 0pt)
   - `industry` match (exact: 2pts, adjacent: 1pt, miss: 0pt)
   - `aesthetic` match (exact: 3pts, adjacent: 1pt, miss: 0pt)
   - `technique` relevance (any tag match: 1pt each, max 3pt)
   - `tier` (site-of-year: 3pt, honorable-mention: 2pt, featured: 1pt, reference: 0pt)
3. Return the top 3 entries by score, formatted as a Taste Brief:

```
TASTE LIBRARY RESULTS
─────────────────────────────────────────────
Query: [brief]
Results: 3 entries (scores: 11, 9, 7)

1. [title] — [url]
   Domain: [domain] | Industry: [industry] | Tier: [tier]
   Layout: [layout pattern]
   Type: [type system — face, scale, weight contrast]
   Color: [color logic — palette, dominant/accent/neutral]
   Motion: [motion signature — what, timing, easing]
   Technique: [extracted technique notes]
   Why it's at the ceiling: [one sentence]

2. [title] — [url]
   [same format]

3. [title] — [url]
   [same format]

─────────────────────────────────────────────
Taste Brief (≤120 words):
[synthesized paragraph citing all 3 entries]
```

4. If fewer than 3 entries match well (score < 4), say so and supplement with
   a live web search recommendation for the gap. Do not fabricate entries.

---

### ADD — add a new entry after a Phase 1 reference pull

```
/taste add
```

Run this at the end of every visual-quality-gate Phase 1 pull to write the
references back to the library so they are available for future tasks.

**Add protocol:**
1. Read `library.json` using `read_file`.
2. For each reference from the current Phase 1 pull, construct a library entry:
   ```json
   {
     "id": "unique-slug-from-title",
     "title": "Site or asset name",
     "url": "https://...",
     "source": "awwwards | fwa | godly | behance | game-title | foundry",
     "tier": "site-of-year | honorable-mention | featured | reference",
     "domain": "web-page | web-ui | 3d-asset | game-asset | motion | typography | illustration",
     "industry": "saas | fintech | entertainment | gaming | fashion | agency | portfolio | other",
     "aesthetic": "editorial | brutalist | minimal | maximalist | sci-fi | organic | corporate | playful",
     "techniques": ["variable-font", "scroll-scrub", "clip-path", "lottie", "webgl", "css-grid", "glassmorphism"],
     "layout": "One sentence describing the layout system",
     "type": "One sentence: faces, scale, weight contrast, tracking",
     "color": "One sentence: palette, dominant/accent/neutral logic",
     "motion": "One sentence: what animates, timing, easing signature",
     "notes": "Specific technique extractions worth reusing — exact values if known",
     "added": "YYYY-MM-DD",
     "quality_score": 0
   }
   ```
3. Check for duplicate `id` — if an entry with the same `id` exists, ask before overwriting.
4. Append the new entries and write `library.json` back using `write_file`.
5. Report: "Added [N] entries. Library now contains [total] entries."

---

### CURATE — improve, tag, or prune the library

```
/taste curate
```

Run periodically (or when asked) to improve library quality.

**Curation protocol:**
1. Read `library.json`.
2. Flag entries that:
   - Have `quality_score < 2` and are older than 90 days
   - Are missing required fields (`layout`, `type`, `color`, `motion`)
   - Have dead URLs (cannot be verified)
   - Duplicate another entry's `url`
3. For each flagged entry, ask: improve it (fill missing fields), keep it as-is,
   or delete it.
4. Increment `quality_score` for entries that have been cited in a Phase 1 pull
   (they are proven useful).
5. Write the updated library back.

---

### STATS — library summary

```
/taste stats
```

Read `library.json` and report:
- Total entries
- Breakdown by domain, industry, aesthetic, tier
- Top 5 most-cited entries (by `quality_score`)
- Entries missing key fields
- Last added date

---

## Library file format

The library lives at `.bob/skills/taste-library/library.json`.

```json
{
  "version": 1,
  "last_updated": "YYYY-MM-DD",
  "entries": [ ... ]
}
```

The `entries` array is an ordered list of entry objects as defined in the ADD
protocol above. Order is irrelevant — entries are always scored and ranked at
query time.

---

## Integration with visual-quality-gate

Phase 1 of `visual-quality-gate` should always run `/taste query` first.
If results score ≥ 7, use them as the Phase 1 references and skip the raw web search.
If results score < 4, supplement with a live web search and then run `/taste add`
to write the new references back.

This creates a compounding improvement loop:
- First task: cold start, web search, add 3 entries
- Second similar task: library has 3 entries, query returns them, Phase 1 is instant
- Tenth similar task: library has 20+ entries, query returns the best 3 from vetted corpus

The library gets better the more it is used. This is the compounding quality advantage
over single-shot reference pulls.

---

## Seed entries

The library ships with a small seed corpus of high-quality references across
all domains. See `library.json`. These are the baseline quality floor — every
entry added should be at least as good as the weakest seed entry.
