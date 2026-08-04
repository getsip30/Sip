'use client';
import { useEffect, useState, useCallback } from 'react';
import { BADGE_META, type BadgeType } from '@/lib/badge-meta';

type Flag = {
  id: string; roomId: string; reporterClerkId: string; reporterRole: string;
  reportedClerkId: string; reportedName: string; reason: string; details: string;
  status: string; createdAt: string; resolvedAt: string | null;
};
type Mentor = {
  id: string; firstName: string; lastName: string; email: string; role: string; company: string;
  isOpen: boolean; autoAccept: boolean; xp: number; sipCount: number; banned: boolean; createdAt: string;
  /** Prestige order, from the badges table. */
  badgeTypes: BadgeType[];
};
type Seeker = {
  id: string; firstName: string; lastName: string; email: string;
  currentStreak: number; banned: boolean; createdAt: string;
};
type Room = { id: string; title: string; roomName: string; status: string; startedAt: string; endedAt: string | null; mentorId: string };
type Req = { id: string; seekerName: string; seekerEmail: string; mentorId: string; status: string; createdAt: string; scheduledAt?: string | null; cancelledAt?: string | null; cancelledBy?: string | null };
type FeedbackEntry = { id: string; requestId: string; mentorId: string; role: string; raterClerkId: string; rating: number; comment: string | null; createdAt: string };
type Ask = { id: string; mentorId: string; seekerClerkId: string; seekerName: string; seekerEmail: string; question: string; answer: string | null; status: string; createdAt: string; answeredAt: string | null };
type Note = { id: string; mentorId: string; seekerName: string; seekerEmail: string | null; note: string; status: string; createdAt: string };
type Referral = { id: string; referrerClerkId: string; referredClerkId: string; referredRole: string; milestone: string; createdAt: string };
type Follow = { id: string; seekerClerkId: string; mentorId: string; createdAt: string };
type Consent = { id: string; clerkId: string; roomId: string | null; context: string; createdAt: string };
type SiteFeedbackEntry = { id: string; clerkId: string | null; path: string | null; message: string; createdAt: string };
type SessionFeedbackEntry = {
  id: string; role: string; rating: number; wouldSipAgain: boolean | null; comment: string | null;
  createdAt: string; seekerClerkId: string; roomTitle: string | null;
  mentorFirstName: string | null; mentorLastName: string | null;
};
type Overview = {
  stats: {
    totalMentors: number; bannedMentors: number; openMentors: number;
    totalSeekers: number; bannedSeekers: number; liveRooms: number;
    openFlags: number; pendingRequests: number; totalSips: number; peopleInQueue: number;
    scheduledSips: number; cancelledSips: number; avgRating: number | null;
    totalAsks: number; pendingAsks: number; totalNotes: number;
    totalReferralSignups: number; totalReferralConversions: number; totalFollows: number; totalConsents: number;
    totalBadges: number; autoAcceptMentors: number;
  };
  mentors: Mentor[]; seekers: Seeker[]; rooms: Room[]; requests: Req[]; feedback: FeedbackEntry[];
  asks: Ask[]; notes: Note[]; referrals: Referral[]; follows: Follow[]; consents: Consent[];
};

const TABS = ['Overview', 'Mentors', 'Seekers', 'Rooms', 'Sips', 'Asks', 'Notes', 'Referrals', 'Follows', 'Consents', 'Flags', 'Feedback', 'Session Feedback'] as const;
type Tab = typeof TABS[number];

const card: React.CSSProperties = { background: '#121923', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 };
const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.1)' };

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<Overview | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [siteFeedback, setSiteFeedback] = useState<SiteFeedbackEntry[]>([]);
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [ov, fl, sf, sess] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/flags'),
        fetch('/api/admin/site-feedback'),
        fetch('/api/admin/session-feedback'),
      ]);
      if (sess.ok) setSessionFeedback(await sess.json());
      if (ov.status === 403 || fl.status === 403 || sf.status === 403) { setForbidden(true); setLoading(false); return; }
      if (ov.ok) setData(await ov.json());
      if (fl.ok) setFlags(await fl.json());
      if (sf.ok) setSiteFeedback(await sf.json());
      setLoading(false);
    } catch (err) {
      console.error('fetchAll failed:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    const t = setInterval(fetchAll, 10000);
    return () => clearInterval(t);
  }, [fetchAll]);

  async function resolveFlag(id: string, action: 'dismiss' | 'action' | 'ban') {
    await fetch(`/api/admin/flags/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    fetchAll();
  }

  async function toggleBan(kind: 'mentors' | 'seekers', id: string, banned: boolean) {
    await fetch(`/api/admin/${kind}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banned: !banned }),
    });
    fetchAll();
  }

  async function endRoom(id: string) {
    await fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' });
    fetchAll();
  }

  if (loading) return <div style={{ background: '#0A0E16', minHeight: '100vh', color: '#8A93A3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>loading...</div>;
  if (forbidden) return <div style={{ background: '#0A0E16', minHeight: '100vh', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>forbidden</div>;
  if (!data) return null;

  const s = data.stats;
  const openFlags = flags.filter(f => f.status === 'open');
  const resolvedFlags = flags.filter(f => f.status !== 'open');

  return (
    <div style={{ background: '#0A0E16', minHeight: '100vh', color: '#EDEFF3', fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", padding: '40px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>Admin</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 30, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ ...btn, background: tab === t ? 'rgba(112,181,249,0.15)' : 'transparent', borderColor: tab === t ? 'rgba(112,181,249,0.4)' : 'rgba(255,255,255,0.1)', color: tab === t ? '#70B5F9' : '#8A93A3', padding: '8px 16px', fontSize: 13 }}>
              {t}{t === 'Flags' && openFlags.length > 0 ? ` (${openFlags.length})` : ''}{t === 'Feedback' && siteFeedback.length > 0 ? ` (${siteFeedback.length})` : ''}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {[
              ['Mentors', s.totalMentors], ['Banned mentors', s.bannedMentors], ['Open mentors', s.openMentors],
              ['Seekers', s.totalSeekers], ['Banned seekers', s.bannedSeekers], ['Live rooms', s.liveRooms],
              ['Open flags', s.openFlags], ['Pending requests', s.pendingRequests], ['Total sips', s.totalSips],
              ['In queue', s.peopleInQueue], ['Scheduled sips', s.scheduledSips], ['Cancelled sips', s.cancelledSips],
              ['Avg rating', s.avgRating ?? '—'], ['Asks', s.totalAsks], ['Pending asks', s.pendingAsks],
              ['Notes', s.totalNotes], ['Referral signups', s.totalReferralSignups], ['Referral conversions', s.totalReferralConversions],
              ['Follows', s.totalFollows], ['Consents logged', s.totalConsents],
              ['Badges awarded', s.totalBadges], ['Auto-accept on', s.autoAcceptMentors],
            ].map(([label, val]) => (
              <div key={label as string} style={card}>
                <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Feedback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {siteFeedback.length === 0 && <div style={{ color: '#8A93A3' }}>No feedback yet.</div>}
            {siteFeedback.map(f => (
              <div key={f.id} style={card}>
                <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 8 }}>
                  {new Date(f.createdAt).toLocaleString()} · {f.path || 'unknown page'}{f.clerkId ? ` · ${f.clerkId}` : ' · anonymous'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{f.message}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Session Feedback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessionFeedback.length === 0 && <div style={{ color: '#8A93A3' }}>No session feedback yet.</div>}
            {sessionFeedback.map(f => (
              <div key={f.id} style={card}>
                <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 8 }}>
                  {new Date(f.createdAt).toLocaleString()} · from the {f.role} · {f.mentorFirstName} {f.mentorLastName}
                  {f.roomTitle ? ` · ${f.roomTitle}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: f.comment ? 8 : 0 }}>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>{'★'.repeat(f.rating)}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{'★'.repeat(5 - f.rating)}</span></span>
                  <span style={{ fontSize: 12, color: f.wouldSipAgain === true ? '#5BDB8A' : f.wouldSipAgain === false ? '#F87171' : '#8A93A3' }}>
                    {f.wouldSipAgain === true ? 'would sip again' : f.wouldSipAgain === false ? 'would not sip again' : 'no answer'}
                  </span>
                </div>
                {f.comment && <div style={{ whiteSpace: 'pre-wrap' }}>{f.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'Mentors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.mentors.map(m => (
              <div key={m.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.firstName} {m.lastName} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {m.role} @ {m.company}</span></div>
                  <div style={{ fontSize: 12, color: '#8A93A3' }}>{m.email} · xp {m.xp} · {m.sipCount} sips · {m.isOpen ? 'open' : 'closed'}{m.autoAccept ? ' · auto-accept' : ''}{m.banned ? ' · BANNED' : ''}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: '#8A93A3' }}>
                    <span style={{ alignSelf: 'center' }}>badges:</span>
                    {(m.badgeTypes ?? []).length === 0 ? <span style={{ alignSelf: 'center' }}>none</span> : m.badgeTypes.map(b => (
                      <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '2px 9px', color: '#EDEFF3' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: BADGE_META[b]?.color, display: 'inline-block' }} />
                        {BADGE_META[b]?.label ?? b}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => toggleBan('mentors', m.id, m.banned)}
                  style={{ ...btn, background: m.banned ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)', borderColor: m.banned ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)', color: m.banned ? '#4ADE80' : '#F87171' }}>
                  {m.banned ? 'unban' : 'ban'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Seekers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.seekers.map(sk => (
              <div key={sk.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{sk.firstName} {sk.lastName}</div>
                  <div style={{ fontSize: 12, color: '#8A93A3' }}>{sk.email} · streak {sk.currentStreak}{sk.banned ? ' · BANNED' : ''}</div>
                </div>
                <button onClick={() => toggleBan('seekers', sk.id, sk.banned)}
                  style={{ ...btn, background: sk.banned ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)', borderColor: sk.banned ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)', color: sk.banned ? '#4ADE80' : '#F87171' }}>
                  {sk.banned ? 'unban' : 'ban'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Rooms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.rooms.length === 0 ? <p style={{ color: '#8A93A3', fontSize: 14 }}>no rooms yet</p> : data.rooms.map(r => (
              <div key={r.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, flexWrap: 'wrap', gap: 10, opacity: r.status === 'live' ? 1 : 0.6 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.title} <span style={{ fontSize: 11, color: r.status === 'live' ? '#4ADE80' : '#8A93A3', fontWeight: 600 }}>· {r.status}</span></div>
                  <div style={{ fontSize: 12, color: '#8A93A3' }}>{r.roomName} · started {new Date(r.startedAt).toLocaleString()}{r.endedAt ? ` · ended ${new Date(r.endedAt).toLocaleString()}` : ''}</div>
                </div>
                {r.status === 'live' && (
                  <button onClick={() => endRoom(r.id)}
                    style={{ ...btn, background: 'rgba(220,38,38,0.15)', borderColor: 'rgba(220,38,38,0.3)', color: '#F87171' }}>
                    force end
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'Sips' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#8A93A3' }}>Scheduled / cancelled</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.requests.filter(r => r.scheduledAt || r.status === 'cancelled').length === 0 ? (
                  <p style={{ color: '#8A93A3', fontSize: 14 }}>nothing scheduled or cancelled yet</p>
                ) : data.requests.filter(r => r.scheduledAt || r.status === 'cancelled').map(r => (
                  <div key={r.id} style={{ ...card, padding: 16 }}>
                    <div style={{ fontWeight: 600 }}>{r.seekerName} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {r.status}</span></div>
                    {r.scheduledAt && <div style={{ fontSize: 12, color: '#8A93A3' }}>scheduled: {new Date(r.scheduledAt).toLocaleString()}</div>}
                    {r.status === 'cancelled' && <div style={{ fontSize: 12, color: '#F87171' }}>cancelled by {r.cancelledBy} · {r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : ''}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#8A93A3' }}>Feedback ({data.feedback.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.feedback.length === 0 ? (
                  <p style={{ color: '#8A93A3', fontSize: 14 }}>no feedback yet</p>
                ) : data.feedback.map(f => (
                  <div key={f.id} style={{ ...card, padding: 16 }}>
                    <div style={{ fontWeight: 600 }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {f.role}</span></div>
                    {f.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{f.comment}</div>}
                    <div style={{ fontSize: 12, color: '#8A93A3', marginTop: 6 }}>{new Date(f.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Asks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.asks.length === 0 ? <p style={{ color: '#8A93A3', fontSize: 14 }}>no asks yet</p> : data.asks.map(a => (
              <div key={a.id} style={{ ...card, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.seekerName} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {a.status}</span></div>
                <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 8 }}>{a.seekerEmail} · {new Date(a.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: 14, marginBottom: a.answer ? 8 : 0 }}>{a.question}</div>
                {a.answer && <div style={{ fontSize: 13, color: '#70B5F9', borderLeft: '2px solid rgba(112,181,249,0.3)', paddingLeft: 10 }}>{a.answer}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'Notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.notes.length === 0 ? <p style={{ color: '#8A93A3', fontSize: 14 }}>no notes yet</p> : data.notes.map(n => (
              <div key={n.id} style={{ ...card, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.seekerName} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {n.status}</span></div>
                <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 8 }}>{n.seekerEmail || 'no email'} · {new Date(n.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: 14 }}>{n.note}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Referrals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.referrals.length === 0 ? <p style={{ color: '#8A93A3', fontSize: 14 }}>no referral activity yet</p> : data.referrals.map(r => (
              <div key={r.id} style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.milestone === 'signed_up' ? 'signup' : 'first sip booked'} <span style={{ color: '#8A93A3', fontWeight: 400 }}>· {r.referredRole}</span></div>
                  <div style={{ fontSize: 12, color: '#8A93A3' }}>referrer {r.referrerClerkId.slice(0, 12)}… → referred {r.referredClerkId.slice(0, 12)}…</div>
                </div>
                <div style={{ fontSize: 12, color: '#8A93A3' }}>{new Date(r.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Flags' && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#FBBF24' }}>Open ({openFlags.length})</h2>
            {openFlags.length === 0 ? <p style={{ color: '#8A93A3', fontSize: 14, marginBottom: 30 }}>no open flags</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
                {openFlags.map(f => (
                  <div key={f.id} style={{ background: '#121923', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: 18 }}>
                    <div style={{ fontSize: 12, color: '#8A93A3', marginBottom: 6 }}>{new Date(f.createdAt).toLocaleString()} · room {f.roomId.slice(0, 8)}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.reportedName} <span style={{ color: '#8A93A3', fontWeight: 400 }}>reported by {f.reporterRole}</span></div>
                    <div style={{ fontSize: 13, color: '#FBBF24', marginBottom: 6 }}>{f.reason}</div>
                    <div style={{ fontSize: 14, marginBottom: 12 }}>{f.details}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => resolveFlag(f.id, 'action')} style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>take action</button>
                      <button onClick={() => { if (confirm(`Ban ${f.reportedName}? This suspends their mentor and seeker accounts.`)) resolveFlag(f.id, 'ban'); }} style={{ background: '#DC2626', border: '1px solid rgba(220,38,38,0.4)', color: 'white', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>action &amp; ban</button>
                      <button onClick={() => resolveFlag(f.id, 'dismiss')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8A93A3', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#8A93A3' }}>Resolved ({resolvedFlags.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolvedFlags.map(f => (
                <div key={f.id} style={{ background: '#121923', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, opacity: 0.6 }}>
                  <div style={{ fontSize: 12, color: '#8A93A3' }}>{f.reportedName} · {f.reason} · {f.status}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
