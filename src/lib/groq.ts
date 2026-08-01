import { fetchWithTimeout, withRetry, isRetryableResponse } from '@/lib/external';
import { logSwallowed } from '@/lib/logger';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const TIMEOUT_MS = 8000;

function call(body: unknown) {
  return withRetry(
    'groq',
    () =>
      fetchWithTimeout(
        GROQ_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      ),
    { attempts: 2, isRetryable: isRetryableResponse }
  );
}

export async function matchMentors(
  query: string,
  mentors: { id: string; firstName: string; role: string; company: string; topics: string; bio: string }[]
): Promise<{ id: string; reason: string }[]> {
  const list = mentors
    .map(m => `ID:${m.id} | ${m.firstName}, ${m.role} @ ${m.company} | topics: ${m.topics} | bio: ${m.bio}`)
    .join('\n');

  let res: Response;
  try {
    res = await call({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You match a seeker\'s described need to the best mentors from a list. Respond with ONLY valid JSON, no markdown: an array of up to 5 objects like [{"id":"<mentor id>","reason":"<one short sentence why this mentor fits>"}], ranked best match first. Only include mentors that are a genuine fit. If none fit, return [].',
        },
        { role: 'user', content: `Seeker is looking for: "${query}"\n\nAvailable mentors:\n${list}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
  } catch (err) {
    logSwallowed('groq.match_unavailable', err, { mentorCount: mentors.length });
    return [];
  }

  if (!res.ok) {
    logSwallowed('groq.match_bad_status', new Error(`status ${res.status}`), { status: res.status });
    return [];
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || '[]';

  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: { id?: string; reason?: string }) => p.id && p.reason)
      .map((p: { id: string; reason: string }) => ({ id: p.id, reason: String(p.reason).slice(0, 200) }));
  } catch (err) {
    logSwallowed('groq.match_unparseable', err, { reply: String(reply).slice(0, 200) });
    return [];
  }
}

/**
 * Returns flagged=true for abusive content. On provider failure it returns
 * `unavailable: true` so callers can fail CLOSED, rather than letting an outage
 * silently disable moderation.
 */
export async function moderateQuestion(
  question: string
): Promise<{ flagged: boolean; reason?: string; unavailable?: boolean }> {
  let res: Response;
  try {
    res = await call({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You moderate questions sent to mentors on a student platform. Respond with ONLY "SAFE" or "FLAGGED: <short reason>". Flag anything abusive, harassing, sexual, hateful, threatening, or spam. Do not flag normal, even blunt or informal, questions about careers, school, or advice.',
        },
        { role: 'user', content: question },
      ],
      temperature: 0,
      max_tokens: 30,
    });
  } catch (err) {
    logSwallowed('groq.moderation_unavailable', err);
    return { flagged: false, unavailable: true };
  }

  if (!res.ok) {
    logSwallowed('groq.moderation_bad_status', new Error(`status ${res.status}`), { status: res.status });
    return { flagged: false, unavailable: true };
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) return { flagged: false, unavailable: true };

  if (reply.startsWith('FLAGGED')) {
    return { flagged: true, reason: reply.replace('FLAGGED:', '').trim() };
  }
  return { flagged: false };
}
