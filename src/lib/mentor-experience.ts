/**
 * Validation for the work-experience list a mentor submits with their profile.
 *
 * The list arrives whole, on POST /api/mentor, and replaces whatever was
 * stored. That is the right shape for a form that owns the entire section: a
 * mentor reordering three roles and deleting a fourth is one save, not four
 * requests that can half-land.
 */

/** How many positions one profile can list. */
export const MAX_EXPERIENCES = 8;

export const MAX_COMPANY_LENGTH = 100;

/**
 * The ceiling that keeps this from becoming LinkedIn.
 *
 * Short on purpose. The section exists so a seeker can spot something
 * impressive in two seconds — "founded it, sold it in 2019" — not so they can
 * read a paragraph. There is no description field and adding one would defeat
 * the point of the feature.
 */
export const MAX_TITLE_LENGTH = 80;

export type ExperienceInput = {
  company: string;
  title: string;
  isCurrent: boolean;
  sortOrder: number;
};

export type ParsedExperiences =
  | { ok: true; entries: ExperienceInput[] }
  | { ok: false; error: string };

/**
 * Validate and normalize the `experiences` field of a request body.
 *
 * `undefined` means "the client did not send the section" and is distinct from
 * `[]`, which means "the mentor removed every entry". The first must leave
 * stored rows alone — otherwise any older client, or the signup form's
 * "finish later" path, would silently wipe a mentor's work history — so it
 * returns an empty result the caller skips on, and only an explicit array
 * reaches the replace.
 */
export function parseExperiences(raw: unknown): ParsedExperiences | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return { ok: false, error: 'Work experience must be a list' };
  if (raw.length > MAX_EXPERIENCES) {
    return { ok: false, error: `You can list up to ${MAX_EXPERIENCES} roles` };
  }

  const entries: ExperienceInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'Invalid work experience entry' };
    const { company, title, isCurrent } = item as Record<string, unknown>;
    if (typeof company !== 'string' || typeof title !== 'string') {
      return { ok: false, error: 'Each role needs a company and a title' };
    }
    const c = company.trim();
    const t = title.trim();
    // A row with neither is the empty form field the "+" button just added.
    // Dropping it silently is kinder than refusing the whole save over a box
    // the mentor opened and thought better of.
    if (!c && !t) continue;
    if (!c || !t) return { ok: false, error: 'Each role needs both a company and a title' };
    if (c.length > MAX_COMPANY_LENGTH) return { ok: false, error: 'One of the company names is too long' };
    if (t.length > MAX_TITLE_LENGTH) {
      return { ok: false, error: `Keep each title under ${MAX_TITLE_LENGTH} characters — it is a one-liner, not a description` };
    }
    entries.push({ company: c, title: t, isCurrent: !!isCurrent, sortOrder: entries.length });
  }

  return { ok: true, entries };
}
