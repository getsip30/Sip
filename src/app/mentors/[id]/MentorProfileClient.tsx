'use client';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import Logo from '@/components/Logo';
import PixelAvatar from '@/components/PixelAvatar';
import { MessageConsentGate } from '@/components/MessageConsentGate';
import BadgePill from '@/components/BadgePill';
import type { BadgeType } from '@/lib/badge-meta';

type EarnedBadge = { badgeType: BadgeType; awardedAt: string };

type Mentor = {
  id: string; firstName: string; lastName: string; role: string; company: string;
  bio: string; topics: string; availability: string; isOpen: boolean; xp: number; sipCount: number;
  linkedin?: string; showLinkedin?: boolean; avgResponseMinutes?: number | null; avatarData?: string;
};

function formatResponseTime(minutes: number): string {
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  if (minutes < 1440) return `~${Math.round(minutes / 60)} hr`;
  return `~${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''}`;
}
type SipNote = { id: string; seekerName: string; note: string; createdAt: string; };

const NOTES_PER_PAGE = 3;

/**
 * Interactive half of the mentor profile.
 *
 * The mentor and their notes now arrive as props from the server component in
 * page.tsx rather than being fetched here on mount. That change is the whole
 * point: this page is the site's only long-tail search asset ("talk to a
 * product manager at X"), and every word that gives it that value — the name,
 * job title, company, bio, topics, and what past seekers said — used to exist
 * only after JavaScript ran. The server HTML was a div containing the word
 * "loading...".
 *
 * Everything genuinely per-visitor (follow state, the prefilled request form,
 * anything gated on `user`) still resolves on the client, because it depends on
 * who is asking and must not be baked into a cached page.
 */
export default function MentorProfileClient({
  mentor: initialMentor,
  notes: initialNotes,
  badges = [],
}: {
  mentor: Mentor;
  notes: SipNote[];
  /** Already in prestige order — the server sorts, so every surface agrees. */
  badges?: EarnedBadge[];
}) {
  const { id } = useParams();
  const { user } = useUser();
  const [mentor] = useState<Mentor>(initialMentor);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [notes] = useState<SipNote[]>(initialNotes);
  const [notesPage, setNotesPage] = useState(0);
  const [noteForm, setNoteForm] = useState({ name: '' });
  const [showLinkedInPrompt, setShowLinkedInPrompt] = useState(false);
  const [linkedinDraft, setLinkedinDraft] = useState('');
  const [liCopied, setLiCopied] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSent, setNoteSent] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [askText, setAskText] = useState('');
  const [askConsent, setAskConsent] = useState(false);
  const [askSent, setAskSent] = useState(false);
  const [askError, setAskError] = useState('');
  const [submittingAsk, setSubmittingAsk] = useState(false);
  const [activeTab, setActiveTab] = useState<'request' | 'note' | 'ask'>('request');

  useEffect(() => {
    if (mentor && !mentor.isOpen) setActiveTab('ask');
  }, [mentor]);
  const [pendingSubmit, setPendingSubmit] = useState<null | 'request' | 'note' | 'ask'>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm(f => ({
      ...f,
      name: f.name || user.firstName || user.fullName || '',
      email: f.email || user.emailAddresses?.[0]?.emailAddress || '',
    }));
  }, [user]);

  // Only the follow state is fetched here now. The mentor and their notes are
  // the same for every visitor and arrive server-rendered; whether *you* follow
  // this mentor is not, and must stay a per-request client read so it is never
  // baked into a cached page.
  useEffect(() => {
    fetch(`/api/mentor/${id}/follow`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setFollowing(data.following); setFollowerCount(data.count); } })
      .catch(err => console.error('fetch follow failed:', err));
  }, [id]);

  async function toggleFollow() {
    if (!user) return;
    setFollowBusy(true);
    const res = await fetch(`/api/mentor/${id}/follow`, { method: following ? 'DELETE' : 'POST' });
    if (res.ok) { setFollowing(!following); setFollowerCount(c => following ? Math.max(0, c - 1) : c + 1); }
    setFollowBusy(false);
  }

  async function handleAskSubmit() {
    if (!mentor || !askText) return;
    if (!user) { setAskError('Sign in to ask a question.'); return; }
    setSubmittingAsk(true);
    setAskError('');
    const res = await fetch('/api/asks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: mentor.id, question: askText, consentToShow: askConsent }),
    });
    if (res.ok) {
      setAskSent(true);
      setAskText('');
    } else {
      const data = await res.json();
      setAskError(data.error || 'Something went wrong');
    }
    setSubmittingAsk(false);
  }

  async function handleNoteSubmit() {
    if (!mentor || !noteForm.name || !noteText) return;
    if (!user) { setNoteError('Sign in to leave a note.'); return; }
    setSubmittingNote(true);
    const res = await fetch('/api/sip-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: mentor.id, seekerName: noteForm.name, note: noteText }),
    });
    if (res.ok) {
      await res.json();
      // Not prepended to `notes`: the note is created with status 'pending' and
      // only appears publicly once the mentor approves it. Showing it here made it
      // look live until the next refresh.
      setNoteSent(true);
      const trimmedNote = noteText.length > 220 ? noteText.slice(0, 220).trim() + '...' : noteText;
      setLinkedinDraft(`Had a good conversation with ${mentor?.firstName} ${mentor?.lastName} (${mentor?.role} @ ${mentor?.company}) recently.\n\n${trimmedNote}`);
      setShowLinkedInPrompt(true);
      setNoteForm({ name: '' });
      setNoteText('');
      setNoteError('');
    } else {
      const data = await res.json();
      setNoteError(data.error || 'Something went wrong');
    }
    setSubmittingNote(false);
  }

  async function handleSubmit() {
    if (!mentor || !form.name || !form.email || !form.message) return;
    setSubmitting(true);
    setRequestError('');
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: mentor.id, seekerName: form.name, seekerEmail: form.email, message: form.message }),
    });
    if (res.ok) { setSent(true); }
    else { const data = await res.json(); setRequestError(data.error || 'Something went wrong'); }
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = { width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  // The loading and not-found branches that used to live here are gone. Neither
  // is reachable any more: the server component resolves the mentor before this
  // renders and calls notFound() if there is none, which returns a real 404
  // status instead of a 200 page that says "Mentor not found" — a soft 404 that
  // told crawlers a missing profile was a valid page worth keeping.

  const totalNotePages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const pagedNotes = notes.slice(notesPage * NOTES_PER_PAGE, notesPage * NOTES_PER_PAGE + NOTES_PER_PAGE);
  const boxStyle: React.CSSProperties = { background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', minHeight: 0 };

  return (
    <div style={{ background: BG, height: isMobile ? 'auto' : '100vh', minHeight: '100vh', color: TEXT, overflow: isMobile ? 'visible' : 'hidden', display: 'flex', flexDirection: 'column' }}>

      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ flex: '0 0 auto', padding: '0 16px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Logo />
        <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← back</button>
      </motion.nav>

      <div id="main-content" style={{ flex: 1, minHeight: 0, maxWidth: 1200, width: '100%', margin: '0 auto', padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box', overflowY: isMobile ? 'visible' : 'auto' }}>

        {/* TOP ROW */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, flex: isMobile ? '0 0 auto' : '1 1 45%', minHeight: 0 }}>

          {/* TOP LEFT: PROFILE CARD */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            style={{ ...boxStyle, flex: isMobile ? 'none' : '1.4', overflowY: isMobile ? 'visible' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
              {mentor.avatarData ? <PixelAvatar data={mentor.avatarData} size={72} /> : (
              <motion.div whileHover={{ scale: 1.06 }} style={{ width: 64, height: 72, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
                {mentor.firstName[0]}{mentor.lastName[0]}
              </motion.div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -1, margin: 0 }}>{mentor.firstName} {mentor.lastName}</h1>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, background: 'rgba(112,181,249,0.1)', border: '1px solid rgba(112,181,249,0.2)', color: LINK, fontWeight: 600 }}>{mentor.xp} XP</span>
                  {user && (
                    <button onClick={toggleFollow} disabled={followBusy}
                      style={{ fontSize: 12, padding: '3px 12px', borderRadius: 20, border: `1px solid ${following ? 'rgba(91,219,138,0.3)' : BORDER}`, background: following ? 'rgba(91,219,138,0.1)' : 'transparent', color: following ? '#5BDB8A' : MUTED, fontWeight: 600, cursor: followBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                      {following ? 'following' : 'follow'}
                    </button>
                  )}
                  {followerCount > 0 && (
                    <span style={{ fontSize: 12, color: MUTED }}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div style={{ color: MUTED, fontSize: 14, marginBottom: 10 }}>
                  {mentor.role} @ {mentor.company}
                  {mentor.showLinkedin && mentor.linkedin && (
                    <> · <a href={mentor.linkedin.startsWith('http') ? mentor.linkedin : `https://${mentor.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: LINK, textDecoration: 'none' }}>LinkedIn ↗</a></>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <motion.span animate={{ opacity: mentor.isOpen ? [1, 0.4, 1] : 1 }} transition={{ duration: 2, repeat: Infinity }}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, background: mentor.isOpen ? 'rgba(91,219,138,0.1)' : 'rgba(139,148,158,0.1)', color: mentor.isOpen ? '#5BDB8A' : MUTED, border: `1px solid ${mentor.isOpen ? 'rgba(91,219,138,0.3)' : 'rgba(139,148,158,0.2)'}`, fontWeight: 600 }}>
                    {mentor.isOpen ? '● open' : '○ closed'}
                  </motion.span>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, background: 'rgba(112,181,249,0.08)', color: LINK, border: '1px solid rgba(112,181,249,0.15)' }}>
                    {mentor.availability}
                  </span>
                  {mentor.avgResponseMinutes != null && (
                    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, background: 'rgba(91,219,138,0.08)', color: '#5BDB8A', border: '1px solid rgba(91,219,138,0.15)' }}>
                      responds in {formatResponseTime(mentor.avgResponseMinutes)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p style={{ color: '#EDEFF3', fontSize: 14, lineHeight: 1.65, marginBottom: 18 }}>&quot;{mentor.bio}&quot;</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mentor.topics.split(',').filter(t => t.trim()).map(t => (
                <span key={t} style={{ background: 'rgba(112,181,249,0.07)', border: '1px solid rgba(112,181,249,0.15)', color: LINK, padding: '5px 14px', borderRadius: 14, fontSize: 13 }}>{t.trim()}</span>
              ))}
            </div>
          </motion.div>

          {/* TOP RIGHT: STATS + BADGES */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            style={{ ...boxStyle, flex: isMobile ? 'none' : '1', overflowY: isMobile ? 'visible' : 'auto' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'XP', value: mentor.xp.toLocaleString(), color: LINK },
                { label: 'Sips', value: mentor.sipCount, color: '#5BDB8A' },
                { label: 'Badges', value: badges.length, color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} style={{ background: BG, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{s.value}</div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {badges.map(b => (
                  <BadgePill key={b.badgeType} badgeType={b.badgeType} size="sm" />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* BOTTOM ROW */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, flex: isMobile ? '0 0 auto' : '1 1 55%', minHeight: 0 }}>

          {/* BOTTOM LEFT: NOTES, PAGINATED */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ ...boxStyle, flex: isMobile ? 'none' : '1', maxHeight: isMobile ? 320 : 'none' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>What people took away</h2>
            {notes.length === 0 ? (
              <div style={{ color: MUTED, fontSize: 13, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                No notes yet. Be the first to leave one.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, marginBottom: 12 }}>
                  {pagedNotes.map(n => (
                    <div key={n.id} style={{ background: BG, borderRadius: 12, padding: '14px 16px' }}>
                      <p style={{ color: '#EDEFF3', fontSize: 13, lineHeight: 1.55, marginBottom: 6 }}>&quot;{n.note}&quot;</p>
                      <div style={{ color: MUTED, fontSize: 11 }}>{n.seekerName}</div>
                    </div>
                  ))}
                </div>
                {totalNotePages > 1 && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {Array.from({ length: totalNotePages }).map((_, i) => (
                      <button key={i} onClick={() => setNotesPage(i)}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: i === notesPage ? ACCENT : 'transparent', color: i === notesPage ? 'white' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* BOTTOM RIGHT: TABBED ACTIONS */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
            style={{ ...boxStyle, flex: isMobile ? 'none' : '1.4' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexShrink: 0, flexWrap: 'wrap' }}>
              {([
                { key: 'request', label: 'Request a sip' },
                { key: 'note', label: 'Leave a note' },
                { key: 'ask', label: 'Ask something' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 20, border: `1px solid ${activeTab === t.key ? 'rgba(112,181,249,0.3)' : BORDER}`, background: activeTab === t.key ? 'rgba(112,181,249,0.1)' : 'transparent', color: activeTab === t.key ? LINK : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AnimatePresence mode="wait">
                {activeTab === 'request' && (
                  <motion.div key="request" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {sent ? (
                      <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden style={{ margin: '0 auto 12px', display: 'block' }}><circle cx="12" cy="12" r="10" stroke="#5BDB8A" strokeWidth="1.5" opacity="0.35"/><path d="M7.5 12.4l3.1 3.1 6-6.4" stroke="#5BDB8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></motion.div>
                        <div style={{ color: '#5BDB8A', fontSize: 16, fontWeight: 600 }}>Sent. They&apos;ll reach out soon.</div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>No cold messages. Just show up.</p>
                        {!mentor.isOpen && (
                          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F59E0B', fontSize: 13, marginBottom: 16 }}>
                            Closed to requests right now, but you can still send one.
                          </div>
                        )}
                        <div style={{ marginBottom: 12 }}>
                          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" autoComplete="name" name="name" aria-label="Your name" style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" placeholder="Your email" autoComplete="email" name="email" aria-label="Your email" style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What are you trying to figure out?" rows={3} aria-label="What are you trying to figure out?" style={{ ...inputStyle, resize: 'none' }} />
                        </div>
                        {requestError && (
                          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 16 }}>
                            {requestError}
                          </div>
                        )}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setPendingSubmit('request')} disabled={submitting}
                          style={{ width: '100%', background: ACCENT, color: 'white', border: 'none', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {submitting ? 'Sending...' : 'Send it *'}
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'note' && (
                  <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {noteSent ? (
                      <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <div style={{ color: '#5BDB8A', fontSize: 15, fontWeight: 600 }}>Thanks, that&apos;s now waiting on their approval.</div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Had a sip with {mentor.firstName}? Leave a quick note.</p>
                        <div style={{ marginBottom: 12 }}>
                          <input value={noteForm.name} onChange={e => setNoteForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" aria-label="Your name" style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What'd you take away?" rows={3} maxLength={1000} aria-label="What'd you take away?" style={{ ...inputStyle, resize: 'none' }} />
                        </div>
                        {noteError && (
                          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 16 }}>
                            {noteError}
                          </div>
                        )}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setPendingSubmit('note')} disabled={submittingNote}
                          style={{ width: '100%', background: 'rgba(91,219,138,0.12)', border: '1px solid rgba(91,219,138,0.3)', color: '#5BDB8A', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: submittingNote ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {submittingNote ? 'Posting...' : 'Post it'}
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'ask' && (
                  <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {askSent ? (
                      <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <div style={{ color: '#5BDB8A', fontSize: 15, fontWeight: 600 }}>Sent. They&apos;ll get back to you soon.</div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Not ready for a full sip? Ask something quick. Limited to 2 per mentor per week.</p>
                        <div style={{ marginBottom: 12 }}>
                          <textarea value={askText} onChange={e => setAskText(e.target.value)} placeholder="What do you want to know?" rows={3} maxLength={500} aria-label="What do you want to know?" style={{ ...inputStyle, resize: 'none' }} />
                        </div>
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <input type="checkbox" id="askConsent" checked={askConsent} onChange={e => setAskConsent(e.target.checked)} style={{ marginTop: 3, accentColor: ACCENT, cursor: 'pointer' }} />
                          <label htmlFor="askConsent" style={{ fontSize: 12, color: MUTED, cursor: 'pointer', lineHeight: 1.5 }}>Ok to feature this publicly on Sip if answered (only your first name shown, never your email)</label>
                        </div>
                        {askError && (
                          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 16 }}>
                            {askError}
                          </div>
                        )}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setPendingSubmit('ask')} disabled={submittingAsk}
                          style={{ width: '100%', background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: submittingAsk ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {submittingAsk ? 'Sending...' : 'Ask'}
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {pendingSubmit && (
        <MessageConsentGate
          onCancel={() => setPendingSubmit(null)}
          onAccept={() => {
            const action = pendingSubmit;
            setPendingSubmit(null);
            if (action === 'request') handleSubmit();
            if (action === 'note') handleNoteSubmit();
            if (action === 'ask') handleAskSubmit();
          }}
        />
      )}

      <AnimatePresence>
        {showLinkedInPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowLinkedInPrompt(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              role="dialog" aria-modal="true" aria-label="Share this on LinkedIn"
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 460 }}>
              <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 6 }}>share this on LinkedIn?</div>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Copy the draft, then paste it into a new LinkedIn post.</div>
              <textarea value={linkedinDraft} onChange={e => setLinkedinDraft(e.target.value)} rows={7}
                style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px', color: TEXT, fontSize: 13.5, lineHeight: 1.6, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { navigator.clipboard.writeText(linkedinDraft); setLiCopied(true); setTimeout(() => setLiCopied(false), 2000); }}
                  style={{ flex: 1, background: liCopied ? 'rgba(91,219,138,0.15)' : 'rgba(255,255,255,0.05)', color: liCopied ? '#5BDB8A' : TEXT, border: `1px solid ${liCopied ? 'rgba(91,219,138,0.3)' : BORDER}`, padding: '12px 0', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {liCopied ? 'copied' : 'copy text'}
                </button>
                <a href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noopener noreferrer"
                  onClick={() => { navigator.clipboard.writeText(linkedinDraft); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT, color: 'white', padding: '12px 0', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>                  open LinkedIn
                </a>
              </div>
              <button onClick={() => setShowLinkedInPrompt(false)} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>skip</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}