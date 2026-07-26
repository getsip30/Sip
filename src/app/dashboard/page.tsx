'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoles } from '@/hooks/useRoles';
import Logo from '@/components/Logo';
import RoleSwitchLink from '@/components/RoleSwitchLink';
import ConfirmDialog from '@/components/ConfirmDialog';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK, SUCCESS2, WARNING, DANGER, PURPLE } from '@/lib/theme';

type Mentor = {
  id: string; firstName: string; lastName: string; role: string; company: string;
  bio: string; topics: string; calendarLink: string | null; contactEmail: string | null; availability: string;
  isOpen: boolean; xp: number; sipCount: number; badges: string; referrerName?: string | null;
};
type Request = {
  id: string; seekerName: string; seekerEmail: string; message: string; status: string; createdAt: string;
  seekerLinkedin?: string; seekerConsentToShow: boolean; mentorConsentToShow: boolean;
};
type Ask = {
  id: string; seekerName: string; question: string; answer: string | null; status: string; createdAt: string;
};
type SipNote = {
  id: string; seekerName: string; note: string; status: string; createdAt: string;
};

const BADGE_META: Record<string, { label: string; color: string }> = {
  'first-sip': { label: 'First Sip', color: '#D97706' },
  'regular':   { label: 'Regular',   color: '#DC2626' },
  'veteran':   { label: 'Veteran',   color: PURPLE },
  'legend':    { label: 'Legend',    color: '#0891B2' },
  'goat':      { label: 'GOAT',      color: '#059669' },
};

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { isSeeker, loaded: rolesLoaded } = useRoles();
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [pendingNotes, setPendingNotes] = useState<SipNote[]>([]);
  const [liveNotes, setLiveNotes] = useState<SipNote[]>([]);
  const [reviewingNote, setReviewingNote] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [shareDrafts, setShareDrafts] = useState<Record<string, boolean>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);
  const [loadingMentor, setLoadingMentor] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [referrals, setReferrals] = useState<{ referralCode: string | null; totalInvites: number; totalConverted: number } | null>(null);
  const [togglingConsent, setTogglingConsent] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [choosingContactFor, setChoosingContactFor] = useState<string | null>(null);
  const [shareNoteDraft, setShareNoteDraft] = useState('');
  const [showShareNote, setShowShareNote] = useState(false);
  const [shareNoteCopied, setShareNoteCopied] = useState(false);

  async function acceptRequest(requestId: string, contactMethod?: 'calendar' | 'email') {
    setAccepting(requestId);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', contactMethod }),
    });
    if (res.ok) setRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: 'accepted' } : x));
    setAccepting(null);
    setChoosingContactFor(null);
  }

  async function toggleConsent(requestId: string, current: boolean) {
    setTogglingConsent(requestId);
    const res = await fetch(`/api/requests/${requestId}/consent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, mentorConsentToShow: updated.mentorConsentToShow } : r));
    }
    setTogglingConsent(null);
  }
  const [isLive, setIsLive] = useState(false);
  
  const fetchData = useCallback(async () => {
  try {
    const [mRes, rRes, liveRes, aRes, refRes] = await Promise.all([fetch('/api/mentor'), fetch('/api/requests'), fetch('/api/rooms'), fetch('/api/asks'), fetch('/api/referrals/me')]);
    if (refRes.ok) setReferrals(await refRes.json());
    if (mRes.ok) {
      const m = await mRes.json();
      setMentor(m);
      if (liveRes.ok) {
        const liveRooms = await liveRes.json();
        setIsLive(liveRooms.some((r: { mentorId: string }) => r.mentorId === m.id));
      }
      const notesRes = await fetch(`/api/sip-notes?mentorId=${m.id}&mine=true`);
      if (notesRes.ok) setPendingNotes(await notesRes.json());
      const liveNotesRes = await fetch(`/api/sip-notes?mentorId=${m.id}`);
      if (liveNotesRes.ok) setLiveNotes(await liveNotesRes.json());
    }
    if (rRes.ok) setRequests(await rRes.json());
    if (aRes.ok) setAsks(await aRes.json());
  } catch (err) {
    console.error('fetchData failed:', err);
  } finally {
    setLoadingMentor(false);
  }
}, []);

  useEffect(() => {
    if (isLoaded && !user) router.push('/');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLoaded && user) { fetchData(); localStorage.setItem('sip_last_role', 'mentor'); }
  }, [isLoaded, user, fetchData, router]);

  async function submitAnswer(askId: string) {
    const answer = answerDrafts[askId];
    if (!answer) return;
    setSubmittingAnswer(askId);
    const res = await fetch(`/api/asks/${askId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, showPublicly: !!shareDrafts[askId] }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAsks(prev => prev.map(a => a.id === askId ? updated : a));
    }
    setSubmittingAnswer(null);
  }

  async function reviewNote(noteId: string, status: 'approved' | 'rejected') {
    setReviewingNote(noteId);
    const res = await fetch(`/api/sip-notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setPendingNotes(prev => prev.filter(n => n.id !== noteId));
      if (status === 'approved') fetchData();
    }
    setReviewingNote(null);
  }

  function deleteNote(noteId: string) {
    setConfirmDeleteId(noteId);
  }

  async function confirmDeleteNote() {
    const noteId = confirmDeleteId;
    if (!noteId) return;
    setConfirmDeleteId(null);
    setDeletingNote(noteId);
    const res = await fetch(`/api/sip-notes/${noteId}`, { method: 'DELETE' });
    if (res.ok) setLiveNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingNote(null);
  }

  async function toggleOpen() {
    if (!mentor) return;
    setTogglingOpen(true);
    const res = await fetch('/api/mentor', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpen: !mentor.isOpen }) });
    if (res.ok) setMentor(await res.json());
    setTogglingOpen(false);
  }

  if (!isLoaded || loadingMentor) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: MUTED, fontSize: 15 }}>loading...</motion.div>
    </div>
  );

  const earnedBadges = mentor?.badges ? mentor.badges.split(',').filter(Boolean) : [];
  const nextMilestone = mentor ? (mentor.sipCount < 1 ? 1 : mentor.sipCount < 5 ? 5 : mentor.sipCount < 10 ? 10 : mentor.sipCount < 25 ? 25 : 50) : 1;
  const progressPct = mentor ? Math.min((mentor.sipCount / nextMilestone) * 100, 100) : 0;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Remove note?"
        message="Remove this note from your profile? This can't be undone."
        confirmLabel="Remove"
        onConfirm={confirmDeleteNote}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <AnimatePresence>
        {choosingContactFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setChoosingContactFor(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>How should they reach you?</h3>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>Pick what gets sent to this seeker.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => acceptRequest(choosingContactFor, 'calendar')} disabled={accepting === choosingContactFor}
                  style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: accepting === choosingContactFor ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  Calendar link
                </button>
                <button onClick={() => acceptRequest(choosingContactFor, 'email')} disabled={accepting === choosingContactFor}
                  style={{ background: 'rgba(91,219,138,0.12)', border: '1px solid rgba(91,219,138,0.3)', color: SUCCESS2, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: accepting === choosingContactFor ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  Email only
                </button>
                <button onClick={() => setChoosingContactFor(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: MUTED, padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShareNote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowShareNote(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460 }}>
              <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 6 }}>share this on LinkedIn?</div>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Copy the draft, then paste it into a new LinkedIn post.</div>
              <textarea value={shareNoteDraft} onChange={e => setShareNoteDraft(e.target.value)} rows={7}
                style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', color: TEXT, fontSize: 13.5, lineHeight: 1.6, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { navigator.clipboard.writeText(shareNoteDraft); setShareNoteCopied(true); setTimeout(() => setShareNoteCopied(false), 2000); }}
                  style={{ flex: 1, background: shareNoteCopied ? 'rgba(91,219,138,0.15)' : 'rgba(255,255,255,0.05)', color: shareNoteCopied ? '#5BDB8A' : TEXT, border: `1px solid ${shareNoteCopied ? 'rgba(91,219,138,0.3)' : 'rgba(255,255,255,0.1)'}`, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {shareNoteCopied ? 'copied ✓' : 'copy text'}
                </button>
                <a href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noopener noreferrer"
                  onClick={() => { navigator.clipboard.writeText(shareNoteDraft); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT, color: 'white', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  open LinkedIn
                </a>
              </div>
              <button onClick={() => setShowShareNote(false)} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>skip</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAV */}
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 16px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,17,23,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '70vw', scrollbarWidth: 'none' }}>
          <Link href="/leaderboard" className="desktop-only" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>leaderboard</Link>
          {rolesLoaded && (isSeeker
            ? <RoleSwitchLink to="/seekers" role="seeker" label="switch to seeker" style={{ color: LINK, textDecoration: 'none', fontSize: 13, border: '1px solid rgba(112,181,249,0.2)', padding: '6px 12px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap' }} />
            : <Link href="/seekers/onboarding" className="desktop-only" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>become a seeker too</Link>)}
            <span className="desktop-only" style={{ color: MUTED, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>hey, {user?.firstName}</span>
          <SignOutButton>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>sign out</motion.button>
          </SignOutButton>
        </div>
      </motion.nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '90px 16px 60px' }}>
        <AnimatePresence mode="wait">
          {!mentor ? (
            <motion.div key="no-profile" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" stroke={MUTED} strokeWidth="1.6"/><path d="M17 9h2a2.5 2.5 0 010 5h-2" stroke={MUTED} strokeWidth="1.6"/></svg>
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>You&apos;re Not Listed Yet</h2>
              <p style={{ color: MUTED, marginBottom: 32, fontSize: 16 }}>Create your mentor profile and start showing up for people.</p>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link href="/mentors/signup" style={{ background: ACCENT, color: 'white', padding: '14px 32px', borderRadius: 24, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>create profile →</Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

              {/* HEADER */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
                <div>
                  <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.5, marginBottom: 6 }}>Your Dashboard</h1>
                  <p style={{ color: MUTED, fontSize: 15 }}>{mentor.role} @ {mentor.company}</p>
                  {mentor.referrerName && (
                    <p style={{ color: LINK, fontSize: 13, marginTop: 6 }}>Invited by {mentor.referrerName}</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={toggleOpen} disabled={togglingOpen}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: mentor.isOpen ? 'rgba(91,219,138,0.1)' : 'rgba(139,148,158,0.1)', border: `1px solid ${mentor.isOpen ? 'rgba(91,219,138,0.3)' : 'rgba(139,148,158,0.2)'}`, color: mentor.isOpen ? SUCCESS2 : MUTED, padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 600, cursor: togglingOpen ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.25s' }}>
                    <motion.span animate={{ opacity: mentor.isOpen ? [1, 0.3, 1] : 1 }} transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ width: 8, height: 8, borderRadius: '50%', background: mentor.isOpen ? SUCCESS2 : MUTED, display: 'inline-block' }} />
                    {togglingOpen ? '...' : mentor.isOpen ? 'open' : 'closed'}
                  </motion.button>
                  {!isLive && (
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${mentor.firstName}'s Sip Room` }) });
                        if (res.ok) { setIsLive(true); const room = await res.json(); router.push(`/rooms/${room.id}`); }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: DANGER, padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER, display: 'inline-block' }} /> go live
                    </motion.button>
                  )}
                  {isLive && (
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                      onClick={async () => { await fetch('/api/rooms', { method: 'DELETE' }); setIsLive(false); }}
                      style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.2)', color: MUTED, padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      end sip
                    </motion.button>
                  )}
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link href="/mentors/signup" style={{ color: LINK, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(112,181,249,0.2)', padding: '10px 20px', borderRadius: 24, display: 'block' }}>edit profile</Link>
                  </motion.div>
                </div>
              </motion.div>

              {/* STATS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, marginBottom: 32 }}>
                {[
                  { label: 'Total Requests', value: requests.length, color: LINK },
                  { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, color: WARNING },
                  { label: 'XP Earned', value: mentor.xp.toLocaleString(), color: SUCCESS2 },
                  { label: 'Sips Given', value: mentor.sipCount, color: PURPLE },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                    whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.15)' }}
                    style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 24px', transition: 'border-color 0.2s' }}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: stat.color, marginBottom: 4, fontFamily: 'Space Mono' }}>{stat.value}</div>
                    <div style={{ color: MUTED, fontSize: 13 }}>{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* XP PROGRESS + BADGES */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 28px', marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600 }}>Progress to next badge</div>
                  <div style={{ color: MUTED, fontSize: 13 }}>{mentor.sipCount} / {nextMilestone} sips</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 8, overflow: 'hidden', marginBottom: 20 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #0A66C2, #7C3AED)', borderRadius: 8 }} />
                </div>
                {earnedBadges.length > 0 ? (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {earnedBadges.map(b => (
                      <motion.div key={b} whileHover={{ scale: 1.05 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 14 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: BADGE_META[b]?.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, color: TEXT }}>{BADGE_META[b]?.label}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: MUTED, fontSize: 13 }}>No badges yet. Your first sip request earns you the First Sip badge.</p>
                )}
              </motion.div>

              {/* SHARE LINK */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                style={{ background: 'rgba(112,181,249,0.06)', border: '1px solid rgba(112,181,249,0.2)', borderRadius: 16, padding: '20px 28px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Your public profile</div>
                  <div style={{ color: MUTED, fontSize: 13 }}>Share this link so people can find and request you directly.</div>
                </div>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/mentors/${mentor.id}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  style={{ background: copied ? 'rgba(91,219,138,0.15)' : ACCENT, color: copied ? SUCCESS2 : 'white', border: copied ? '1px solid rgba(91,219,138,0.3)' : 'none', padding: '10px 22px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                  {copied ? 'copied ✓' : 'copy link'}
                </motion.button>
              </motion.div>

              {/* REFERRALS */}
              {referrals?.referralCode && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
                  style={{ background: 'rgba(91,219,138,0.06)', border: '1px solid rgba(91,219,138,0.2)', borderRadius: 16, padding: '20px 28px', marginBottom: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: referrals.totalInvites > 0 ? 16 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Invite other mentors</div>
                      <div style={{ color: MUTED, fontSize: 13 }}>Know someone who'd be good at this? Send them your link.</div>
                    </div>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/mentors/signup?ref=${referrals.referralCode}`); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }}
                      style={{ background: refCopied ? 'rgba(91,219,138,0.15)' : 'rgba(91,219,138,0.15)', color: SUCCESS2, border: '1px solid rgba(91,219,138,0.3)', padding: '10px 22px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                      {refCopied ? 'copied ✓' : 'copy invite link'}
                    </motion.button>
                  </div>
                  {referrals.totalInvites > 0 && (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13, color: MUTED }}>
                      <span><strong style={{ color: TEXT }}>{referrals.totalInvites}</strong> invited</span>
                      <span><strong style={{ color: TEXT }}>{referrals.totalConverted}</strong> gave their first sip</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* PENDING NOTES */}
              {pendingNotes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Notes Waiting for Your Approval</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pendingNotes.map(n => (
                      <div key={n.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.seekerName}</div>
                        <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>&quot;{n.note}&quot;</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                            onClick={() => reviewNote(n.id, 'approved')} disabled={reviewingNote === n.id}
                            style={{ background: 'rgba(91,219,138,0.15)', border: '1px solid rgba(91,219,138,0.3)', color: SUCCESS2, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            approve ✓
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                            onClick={() => reviewNote(n.id, 'rejected')} disabled={reviewingNote === n.id}
                            style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: DANGER, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            reject
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* LIVE NOTES */}
              {liveNotes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.375 }} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Live on Your Profile</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {liveNotes.map(n => (
                      <div key={n.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.seekerName}</div>
                        <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>&quot;{n.note}&quot;</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              const trimmed = n.note.length > 200 ? n.note.slice(0, 200).trim() + '...' : n.note;
                              setShareNoteDraft(`"${trimmed}"\n\n— ${n.seekerName}`);
                              setShowShareNote(true);
                            }}
                            style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            share
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                            onClick={() => deleteNote(n.id)} disabled={deletingNote === n.id}
                            style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: DANGER, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: deletingNote === n.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            {deletingNote === n.id ? 'removing...' : 'remove from profile'}
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* PENDING ASKS */}
              {asks.filter(a => a.status === 'pending').length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Quick Questions</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {asks.filter(a => a.status === 'pending').map(a => (
                      <div key={a.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.seekerName}</div>
                        <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>&quot;{a.question}&quot;</p>
                        <textarea value={answerDrafts[a.id] || ''} onChange={e => setAnswerDrafts(d => ({ ...d, [a.id]: e.target.value }))}
                          placeholder="Type your answer..." rows={2} maxLength={1000}
                          style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 10 }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                          <input type="checkbox" id={`share-${a.id}`} checked={!!shareDrafts[a.id]} onChange={e => setShareDrafts(d => ({ ...d, [a.id]: e.target.checked }))} style={{ marginTop: 3, accentColor: ACCENT, cursor: 'pointer' }} />
                          <label htmlFor={`share-${a.id}`} style={{ fontSize: 12, color: MUTED, cursor: 'pointer', lineHeight: 1.5 }}>Ok to feature on the public answers page (only shows if they also opted in — only their first name is shown)</label>
                        </div>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => submitAnswer(a.id)} disabled={submittingAnswer === a.id}
                          style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: submittingAnswer === a.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {submittingAnswer === a.id ? 'Sending...' : 'Answer'}
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* REQUESTS */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Incoming Sips</h2>
                {requests.length === 0 ? (
                  <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', color: MUTED }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={MUTED} strokeWidth="1.6"/><path d="M3 7l9 6 9-6" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </div>
                    <p>No requests yet - share your profile link to get started</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {requests.map((r, i) => (
                      <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}
                        style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, transition: 'all 0.2s', opacity: r.status === 'declined' ? 0.45 : 1, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.seekerName}</div>
                          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>
                            {r.seekerEmail}
                            {r.seekerLinkedin && (
                              <> · <a href={r.seekerLinkedin.startsWith('http') ? r.seekerLinkedin : `https://${r.seekerLinkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: LINK, textDecoration: 'none' }}>LinkedIn ↗</a></>
                            )}
                          </div>
                            <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.6, margin: 0 }}>&quot;{r.message}&quot;</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, minWidth: 0, flex: '1 1 140px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 12, background: r.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(91,219,138,0.1)', color: r.status === 'pending' ? WARNING : SUCCESS2, border: `1px solid ${r.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(91,219,138,0.3)'}` }}>{r.status}</span>
                          <div style={{ color: MUTED, fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                          {r.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                disabled={accepting === r.id}
                                onClick={() => {
                                  if (mentor?.calendarLink && mentor?.contactEmail) setChoosingContactFor(r.id);
                                  else acceptRequest(r.id);
                                }}
                                style={{ background: 'rgba(91,219,138,0.15)', border: '1px solid rgba(91,219,138,0.3)', color: SUCCESS2, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: accepting === r.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                {accepting === r.id ? 'accepting...' : 'accept ✓'}
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                onClick={async () => {
                                  const res = await fetch(`/api/requests/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'declined' }) });
                                  if (res.ok) setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'declined' } : x));
                                }}
                                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: DANGER, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                decline
                              </motion.button>
                            </div>
                          )}
                          {r.status === 'accepted' && (
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                              onClick={() => toggleConsent(r.id, r.mentorConsentToShow)} disabled={togglingConsent === r.id}
                              style={{ background: r.mentorConsentToShow ? 'rgba(91,219,138,0.1)' : 'transparent', border: `1px solid ${r.mentorConsentToShow ? 'rgba(91,219,138,0.3)' : 'rgba(255,255,255,0.1)'}`, color: r.mentorConsentToShow ? SUCCESS2 : MUTED, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {r.mentorConsentToShow ? 'showing on profiles ✓' : 'show on profiles'}
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}