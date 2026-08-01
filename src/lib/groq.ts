export async function matchMentors(
  query: string,
  mentors: { id: string; firstName: string; role: string; company: string; topics: string; bio: string }[]
): Promise<{ id: string; reason: string }[]> {
  const list = mentors.map(m => `ID:${m.id} | ${m.firstName}, ${m.role} @ ${m.company} | topics: ${m.topics} | bio: ${m.bio}`).join('\n');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You match a seeker\'s described need to the best mentors from a list. Respond with ONLY valid JSON, no markdown: an array of up to 5 objects like [{"id":"<mentor id>","reason":"<one short sentence why this mentor fits>"}], ranked best match first. Only include mentors that are a genuine fit. If none fit, return [].',
        },
        { role: 'user', content: `Seeker is looking for: "${query}"\n\nAvailable mentors:\n${list}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || '[]';

  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: { id?: string; reason?: string }) => p.id && p.reason)
      .map((p: { id: string; reason: string }) => ({ id: p.id, reason: String(p.reason).slice(0, 200) }));
  } catch {
    return [];
  }
}

/**
 * Returns flagged=true for abusive content. On provider failure it returns
 * `unavailable: true` so callers can fail CLOSED — previously any Groq outage
 * silently disabled moderation entirely.
 */
export async function moderateQuestion(question: string): Promise<{ flagged: boolean; reason?: string; unavailable?: boolean }> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You moderate questions sent to mentors on a student platform. Respond with ONLY "SAFE" or "FLAGGED: <short reason>". Flag anything abusive, harassing, sexual, hateful, threatening, or spam. Do not flag normal, even blunt or informal, questions about careers, school, or advice.',
        },
        { role: 'user', content: question },
      ],
      temperature: 0,
      max_tokens: 30,
    }),
  });

    if (!res.ok) return { flagged: false, unavailable: true };

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return { flagged: false, unavailable: true };

    if (reply.startsWith('FLAGGED')) {
      return { flagged: true, reason: reply.replace('FLAGGED:', '').trim() };
    }
    return { flagged: false };
  } catch (err) {
    console.error('moderateQuestion failed:', err);
    return { flagged: false, unavailable: true };
  }
}