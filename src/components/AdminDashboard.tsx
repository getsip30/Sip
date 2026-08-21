'use client';
import { useCallback, useEffect, useState } from 'react';
import { SURFACE, BORDER, TEXT, MUTED, LINK, SUCCESS2, WARNING, DANGER, ACCENT_SOFT } from '@/lib/theme';

/**
 * The analytics tab of /admin: headline metrics, the signup funnel, the mail
 * that has gone out, and a broadcast composer.
 *
 * A separate file rather than another branch in admin/page.tsx, which is already
 * long enough that a fifth of a screen of new markup would be hard to find. It
 * owns its own fetching for the same reason: the parent polls every ten seconds
 * for moderation queues, and re-fetching a funnel on that cadence would be
 * wasted work — worse, it would fight with someone typing in the send form.
 */

type Metrics = {
  range: { from: string; to: string; days: number };
  weeklyActiveUsers: number;
  sipsRequested: number;
  sipsAccepted: number;
};

type FunnelStep = {
  eventType: string;
  label: string;
  users: number;
  events: number;
  conversionFromPrev: number | null;
};

type Funnel = {
  range: { from: string; to: string; days: number };
  steps: FunnelStep[];
  overallConversion: number | null;
};

type EmailLogRow = {
  id: string;
  recipientEmail: string;
  subject: string;
  emailType: string;
  audience: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string;
};

type Audience = 'all_seekers' | 'all_mentors' | 'everyone' | 'specific';

const AUDIENCE_LABELS: Record<Audience, string> = {
  all_seekers: 'All Seekers',
  all_mentors: 'All Mentors',
  everyone: 'Everyone',
  specific: 'Specific',
};

const RANGES = [7, 30, 90] as const;

const card: React.CSSProperties = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 20,
};

const input: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: TEXT,
  fontSize: 13,
  fontFamily: 'inherit',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: MUTED,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

/** Colour for an email_logs status. Unknown values stay neutral. */
function statusColor(status: string) {
  if (status === 'sent' || status === 'delivered') return SUCCESS2;
  if (status === 'bounced') return WARNING;
  if (status === 'failed') return DANGER;
  return MUTED;
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [
    [60, 'm'],
    [3600, 'h'],
    [86400, 'd'],
  ];
  if (seconds < 3600) return `${Math.floor(seconds / units[0][0])}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / units[1][0])}h ago`;
  return `${Math.floor(seconds / units[2][0])}d ago`;
}

function pct(value: number | null) {
  return value == null ? '—' : `${value}%`;
}

export default function AdminDashboard() {
  const [days, setDays] = useState<number>(7);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [emails, setEmails] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [audience, setAudience] = useState<Audience>('all_seekers');
  const [specificEmail, setSpecificEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, f, n] = await Promise.all([
        fetch(`/api/admin/dashboard/metrics?days=${days}`),
        fetch(`/api/admin/dashboard/funnel?days=${days}`),
        fetch('/api/admin/dashboard/notifications'),
      ]);
      if (m.ok) setMetrics(await m.json());
      if (f.ok) setFunnel(await f.json());
      if (n.ok) setEmails(await n.json());
    } catch (err) {
      console.error('dashboard load failed:', err);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    // A broadcast cannot be recalled, and the audience is chosen from a dropdown
    // one click away from "Everyone". Worth one confirm.
    const who = AUDIENCE_LABELS[audience];
    const target = audience === 'specific' ? specificEmail : who.toLowerCase();
    if (!confirm(`Send "${subject}" to ${target}? This cannot be undone.`)) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/dashboard/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          specificEmail: audience === 'specific' ? specificEmail : undefined,
          subject,
          content,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSendResult({ ok: false, message: data.error ?? 'Send failed.' });
      } else {
        setSendResult({
          ok: data.failed === 0,
          message: data.failed === 0
            ? `Sent to ${data.sent} of ${data.total}.`
            : `Sent ${data.sent}, failed ${data.failed}, of ${data.total}. See the Notification Center for the failures.`,
        });
        setSubject('');
        setContent('');
        // Reload so the sends that just happened appear in the feed below.
        load();
      }
    } catch {
      setSendResult({ ok: false, message: 'Send failed. Check your connection and try again.' });
    }
    setSending(false);
  }

  const steps = funnel?.steps ?? [];
  const peak = Math.max(1, ...steps.map(s => s.users));
  // Conversion above 100% is legitimate here, not a rendering bug — see the
  // note rendered beneath the funnel.
  const hasOverHundred = steps.some(s => s.conversionFromPrev != null && s.conversionFromPrev > 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: MUTED }}>Range</span>
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setDays(r)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: days === r ? ACCENT_SOFT : 'transparent',
              border: `1px solid ${days === r ? LINK : BORDER}`,
              color: days === r ? LINK : MUTED,
            }}
          >
            {r}d
          </button>
        ))}
        {loading && <span style={{ fontSize: 12, color: MUTED }}>loading…</span>}
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[
          ['Weekly Active Users', metrics?.weeklyActiveUsers, 'last 7 days, always'],
          ['Sips Requested', metrics?.sipsRequested, `last ${days} days`],
          ['Sips Accepted', metrics?.sipsAccepted, `last ${days} days`],
        ].map(([title, value, sub]) => (
          <div key={title as string} style={card}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{value ?? '—'}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Main column + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Funnel */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>User funnel</h2>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 18 }}>
              Distinct people per step over the last {days} days
              {funnel?.overallConversion != null && ` · ${funnel.overallConversion}% end to end`}
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
              {steps.map((s, i) => (
                <div key={s.eventType} style={{ display: 'flex', alignItems: 'stretch', gap: 4, flex: '1 1 0', minWidth: 108 }}>
                  {i > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 44 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>→</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: s.conversionFromPrev == null ? MUTED
                          : s.conversionFromPrev > 100 ? WARNING
                          : s.conversionFromPrev >= 50 ? SUCCESS2
                          : LINK,
                      }}>
                        {pct(s.conversionFromPrev)}
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{s.users}</div>
                    {/* Bar height is relative to the largest step, so the shape of
                        the drop-off is readable without an axis. */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${(s.users / peak) * 100}%`, background: LINK, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{s.label}</div>
                  </div>
                </div>
              ))}
              {steps.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>No events in this range yet.</div>}
            </div>

            {hasOverHundred && (
              <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <span style={{ color: WARNING, fontWeight: 600 }}>Above 100% is expected here.</span>{' '}
                A mentor can start a 1:1 from a live room that no seeker requested, so
                those sips are accepted without a matching request. Steps also count
                people who did that thing in this window, not a cohort followed
                through — someone who landed last month and signed up today counts in
                the second step and not the first.
              </p>
            )}
          </div>

          {/* Notification Center */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Notification Center</h2>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
              Last 20 sends. Only broadcasts are logged today — the app&apos;s transactional
              mail (accepts, reminders, nudges) still sends without recording a row.
            </div>

            {emails.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 14 }}>Nothing logged yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {emails.map((e, i) => (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                      padding: '10px 0',
                      borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.subject}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.recipientEmail} · {e.emailType}
                      </div>
                      {e.errorMessage && (
                        <div style={{ fontSize: 11, color: DANGER, marginTop: 2 }}>{e.errorMessage}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{timeAgo(e.sentAt)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(e.status) }}>{e.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Conversion rate — same numbers as the funnel, read vertically. */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Conversion Rate</h2>
            {steps.length <= 1 ? (
              <p style={{ color: MUTED, fontSize: 14 }}>Not enough data yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {steps.slice(1).map((s, i) => (
                  <div key={s.eventType}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: MUTED, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {steps[i].label} → {s.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{pct(s.conversionFromPrev)}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(s.conversionFromPrev ?? 0, 100)}%`,
                        background: s.conversionFromPrev != null && s.conversionFromPrev > 100 ? WARNING : LINK,
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                ))}
                {funnel?.overallConversion != null && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: MUTED }}>Landing → accepted</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pct(funnel.overallConversion)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send Notification */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Send Notification</h2>
            <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={label} htmlFor="audience">Audience</label>
                <select
                  id="audience"
                  value={audience}
                  onChange={e => setAudience(e.target.value as Audience)}
                  style={input}
                >
                  {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                    <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                  ))}
                </select>
              </div>

              {audience === 'specific' && (
                <div>
                  <label style={label} htmlFor="specific-email">Email address</label>
                  <input
                    id="specific-email"
                    type="email"
                    required
                    value={specificEmail}
                    onChange={e => setSpecificEmail(e.target.value)}
                    placeholder="someone@example.com"
                    style={input}
                  />
                </div>
              )}

              <div>
                <label style={label} htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  required
                  maxLength={120}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  style={input}
                />
              </div>

              <div>
                <label style={label} htmlFor="content">Content</label>
                <textarea
                  id="content"
                  required
                  rows={7}
                  maxLength={10000}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
                />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>
                  Plain text. A blank line starts a new paragraph.
                </div>
              </div>

              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: sending ? 'default' : 'pointer',
                  background: ACCENT_SOFT,
                  border: `1px solid ${LINK}`,
                  color: LINK,
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>

              {sendResult && (
                <div style={{ fontSize: 12, lineHeight: 1.6, color: sendResult.ok ? SUCCESS2 : DANGER }}>
                  {sendResult.message}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
