
'use client';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK, CLAY } from '@/lib/theme';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRoles } from '@/hooks/useRoles';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { ease, DUR, swapVariants, badgeVariants, badgeTransition, listItem } from '@/lib/motion';
import { useRequestList, RequestFilterBar, ShowMore } from '@/components/RequestFilters';
import Link from 'next/link';
import Logo from '@/components/Logo';
import AppTour, { TourStep } from '@/components/AppTour';
import RoleSwitchLink from '@/components/RoleSwitchLink';
import PixelAvatar from '@/components/PixelAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense } from 'react';
import { safeExternalUrl } from '@/lib/utils';

type LiveRoom = { id: string; title: string; firstName: string; lastName: string; role: string; company: string; mentorId: string; startedAt: string; topics?: string; avatarData?: string | null };
type UpcomingRoom = { id: string; title: string; scheduledAt: string; firstName: string; lastName: string; role: string; company: string };

type Mentor = {
  id: string; firstName: string; lastName: string; role: string; company: string;
  topics: string; bio: string; isOpen: boolean; availability: string; avatarData?: string;
};
type SipRequest = {
  id: string; mentorId: string; seekerName: string; seekerEmail: string; message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'; createdAt: string; originRoomId?: string | null;
  seekerConsentToShow: boolean; mentorConsentToShow: boolean;
  scheduledAt?: string | null; cancelledAt?: string | null; cancelledBy?: string | null;
  seekerFeedbackGiven?: boolean; mentorNote?: string | null;
  mentor?: { firstName: string; lastName: string; role: string; company: string; calendarLink: string; contactEmail?: string; };
};

const AVATARS = [ACCENT, CLAY, '#059669', '#DC2626', '#D97706', '#0891B2'];
const INITIALS = (m: Mentor) => `${m.firstName[0]}${m.lastName[0]}`;
const ALL_FILTERS = ['all', 'tech', 'startups', 'design', 'VC', 'AI/ML', 'product', 'finance', 'research', 'engineering', 'computer science', 'data science', 'marketing', 'consulting', 'law', 'medicine', 'entrepreneurship', 'business', 'psychology', 'co-op', 'grad school'];
const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', border: 'rgba(245,158,11,0.3)',  label: 'pending' },
  accepted: { bg: 'rgba(91,219,138,0.1)',  color: '#5BDB8A', border: 'rgba(91,219,138,0.3)',  label: 'accepted' },
  declined: { bg: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'rgba(248,113,113,0.3)', label: 'declined' },
  cancelled: { bg: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'rgba(248,113,113,0.3)', label: 'cancelled' },
};

const SEEKER_TOUR_STEPS: TourStep[] = [
  { label: 'Browse', title: 'Find a Mentor', description: 'Filter by topic, or search by name, role, or company.', bullets: ['Every mentor lists their actual topics', 'Live tag shows who you can talk to right now'] },
  { label: 'Request', title: 'Send a Sip Request', description: 'Write a couple sentences on what you want to talk about.', bullets: ['They accept or decline', 'Accepted = calendar link or email to book a time'] },
  { label: 'Live Rooms', title: 'Live Sip Rooms', description: 'Some mentors go live. Join the queue instead of sending a request.', bullets: ['Anonymous until the mentor picks you', 'No scheduling, it just happens'] },
  { label: 'My Sips', title: 'My Sips Tab', description: 'Every request you send lands here.', bullets: ['Pending, accepted, past, all in one place', 'Leave feedback after so it counts toward the mentor\'s total'] },
  { label: 'Streaks', title: 'Streaks', description: 'Optional. Tracks how often you show up, ranked on the leaderboard.' },
];

function SeekersContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMentor, isSeeker, loaded: rolesLoaded } = useRoles();
  const [tab, setTab] = useState<'browse' | 'live' | 'mine'>('browse');
  const [page, setPage] = useState(1);

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Mentor | null>(null);
  const [filter, setFilter] = useState(searchParams.get('topic') || 'all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');


  const [lookupDone, setLookupDone] = useState(false);
  const [requests, setRequests] = useState<SipRequest[]>([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [myFlags, setMyFlags] = useState<{ id: string; reason: string; createdAt: string }[]>([]);
  const [seekerId, setSeekerId] = useState<string | null>(null);
  const [seekerProfile, setSeekerProfile] = useState<{ age?: number | null; linkedin?: string | null; interests?: string | null; avatarData?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [togglingConsent, setTogglingConsent] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, number>>({});
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.firstName) setForm(f => ({ ...f, name: user.firstName! }));
    if (user?.emailAddresses?.[0]) {
      setForm(f => ({ ...f, email: user.emailAddresses[0].emailAddress }));
    }
    if (user) localStorage.setItem('sip_last_role', 'seeker');
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) handleLookup();
  }, [user]);

  const fetchMentors = useCallback(async () => {
    const res = await fetch('/api/mentor?all=true');
    if (res.ok) setMentors(await res.json());
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchMentors(); }, [fetchMentors]);

  useEffect(() => {
    const mentorId = searchParams.get('mentor');
    if (mentorId && !loading && mentors.length > 0) {
      const target = mentors.find(m => m.id === mentorId);
      if (target) {
        setModal(target);
        router.replace('/seekers', { scroll: false });
      }
    }
  }, [mentors, loading, searchParams, router]);

  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const fetchLiveRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) setLiveRooms(await res.json());
    } catch (e) {
      console.warn('fetchLiveRooms failed', e);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLiveRooms();
    const t = setInterval(fetchLiveRooms, 15000);
    return () => clearInterval(t);
  }, [fetchLiveRooms]);

  const [upcomingRooms, setUpcomingRooms] = useState<UpcomingRoom[]>([]);
  const fetchUpcomingRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms/upcoming');
      if (res.ok) setUpcomingRooms(await res.json());
    } catch (e) {
      console.warn('fetchUpcomingRooms failed', e);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUpcomingRooms();
    const t = setInterval(fetchUpcomingRooms, 60000);
    return () => clearInterval(t);
  }, [fetchUpcomingRooms]);
  
  async function saveSchedule(requestId: string) {
    const scheduledAt = scheduleDrafts[requestId];
    if (!scheduledAt) {
      setScheduleErrors(d => ({ ...d, [requestId]: 'pick a date and time first' }));
      return;
    }
    setScheduleErrors(d => ({ ...d, [requestId]: '' }));
    setScheduling(requestId);
    const res = await fetch(`/api/requests/${requestId}/schedule`,  {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, scheduledAt: updated.scheduledAt } : r));
    } else {
      setScheduleErrors(d => ({ ...d, [requestId]: 'something went wrong, try again' }));
    }
    setScheduling(null);
  }

  async function cancelRequest(requestId: string) {
    setCancelling(requestId);
    const res = await fetch(`/api/requests/${requestId}/cancel`, { method: 'PATCH' });
    if (res.ok) {
      const updated = await res.json();
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'cancelled', cancelledAt: updated.cancelledAt, cancelledBy: updated.cancelledBy } : r));
    }
    setCancelling(null);
  }

  async function submitFeedback(requestId: string) {
    const rating = feedbackRatings[requestId];
    if (!rating) return;
    setSubmittingFeedback(requestId);
    const res = await fetch(`/api/requests/${requestId}/feedback`,  {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment: feedbackComments[requestId] || undefined }),
    });
    if (res.ok) setRequests(prev => prev.map(r => r.id === requestId ? { ...r, seekerFeedbackGiven: true } : r));
    setSubmittingFeedback(null);
  }

  const filtered = mentors.filter(m => {
    const matchFilter = filter === 'all' || m.topics.toLowerCase().includes(filter.toLowerCase());
    const q = search.toLowerCase();
    const matchSearch = !q || m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.company.toLowerCase().includes(q) || m.topics.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [filter, search]);

  async function handleSubmit() {
    if (!form.name || !form.email || !form.message || !modal) return;
    setSubmitting(true);
    setModalError('');
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: modal.id, seekerName: form.name, message: form.message }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setModalError(data.error || 'Something went wrong. Try again.');
      return;
    }
    setSent(true);
    setTimeout(() => { setModal(null); setSent(false); setForm(f => ({ ...f, message: '' })); }, 2200);
  }

  // Status is owned by the mentor: they accept, decline or cancel, and none of
  // that reaches this tab on its own. Split out from handleLookup so it can be
  // re-run without touching the loading and error state of the first load.
  const refreshSips = useCallback(async () => {
    try {
      const res = await fetch('/api/my-sips');
      if (res.ok) setRequests(await res.json());
    } catch {
      // A failed refresh keeps whatever is already on screen.
    }
  }, []);

  useLiveRefresh(refreshSips, { enabled: lookupDone });

  async function handleLookup() {
    setLoadingLookup(true);
    setError('');
    const res = await fetch('/api/my-sips');
    if (res.ok) {
      setRequests(await res.json());
      setLookupDone(true);
      const seekerRes = await fetch('/api/seeker');
      if (seekerRes.ok) {
        const data = await seekerRes.json();
        if (data) {
          setStreak({ currentStreak: data.currentStreak || 0, longestStreak: data.longestStreak || 0 });
          setSeekerId(data.id);
          setMyFlags(data.flags || []);
          setSeekerProfile(data);
        }
      }
    } else if (res.status === 401) {
      setError('Please sign in to view your sips.');
    } else {
      setError('Something went wrong. Try again.');
    }
    setLoadingLookup(false);
  }

  const sipList = useRequestList(requests);
  const pending = requests.filter(r => r.status === 'pending');
  const accepted = requests.filter(r => r.status === 'accepted');

  async function toggleConsent(requestId: string, current: boolean) {
    setTogglingConsent(requestId);
    const res = await fetch(`/api/requests/${requestId}/consent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, seekerConsentToShow: updated.seekerConsentToShow } : r));
    }
    setTogglingConsent(null);
  }

  // A mentor can hold more than one live room, and the badge is a count of
  // people you could talk to, not of rooms.
  const liveMentorCount = new Set(liveRooms.map(r => r.mentorId)).size;

  // badgeColor defaults to the amber used for "my sips". Live takes the red this
  // page already uses everywhere else to mean live, so the count reads as
  // liveness rather than as another pile of pending items.
  const tabBtn = (id: 'browse' | 'live' | 'mine', label: string, badge?: number, badgeColor = '#F59E0B') => (
    <button onClick={() => setTab(id)} style={{
      background: tab === id ? 'rgba(112,181,249,0.12)' : 'transparent',
      border: `1px solid ${tab === id ? 'rgba(112,181,249,0.4)' : BORDER}`,
      color: tab === id ? LINK : MUTED, padding: '10px 22px', borderRadius: 20,
      fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      <AnimatePresence initial={false}>
        {!!badge && (
          <motion.span key="badge" variants={badgeVariants} initial="hidden" animate="visible" exit="exit" transition={badgeTransition}
            style={{ background: badgeColor, color: '#0A0E16', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px', display: 'inline-block' }}>{badge}</motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: BG, minHeight: '100vh', color: TEXT }}>

      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 40px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap', maxWidth: '65vw', scrollbarWidth: 'none' }}>
          <button onClick={() => setShowTour(true)} style={{ background: 'none', color: MUTED, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>how sip works</button>
          <Link href="/leaderboard" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 20 }}>leaderboard</Link>
          {rolesLoaded && isMentor
            ? <RoleSwitchLink to="/dashboard" role="mentor" label="switch to mentor" style={{ color: LINK, textDecoration: 'none', fontSize: 13, border: '1px solid rgba(112,181,249,0.2)', padding: '6px 14px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap' }} />
            : <Link href="/mentors/signup" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 20 }}>become a mentor</Link>}
          {rolesLoaded && isSeeker && <Link href="/seekers/onboarding" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 20 }}>edit profile</Link>}
        </div>
      </motion.nav>

      <div id="main-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '90px 16px 20px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, marginBottom: 20 }}>Find Your Sip</h1>
        {(() => {
          if (!seekerProfile) return null;
          const checklist = [
            { label: 'Add your age', done: !!seekerProfile.age },
            { label: 'Add your LinkedIn', done: !!seekerProfile.linkedin },
            { label: "Tell us what you're into", done: !!seekerProfile.interests },
            { label: 'Add a profile picture', done: !!seekerProfile.avatarData },
          ];
          if (checklist.every(c => c.done)) return null;
          return (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 26px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 600 }}>Finish setting up your profile</div>
                <Link href="/seekers/onboarding" style={{ color: LINK, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>edit →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {checklist.map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: item.done ? MUTED : TEXT, textDecoration: item.done ? 'line-through' : 'none' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${item.done ? 'rgba(91,219,138,0.4)' : BORDER}`, background: item.done ? 'rgba(91,219,138,0.15)' : 'transparent', color: '#5BDB8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                      {item.done ? '✓' : ''}
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          {tabBtn('browse', 'browse mentors')}
          {tabBtn('live', 'live now', liveMentorCount, '#DC2626')}
          {tabBtn('mine', 'my sips', pending.length)}
        </div>
      </div>

      {tab === 'browse' && upcomingRooms.length > 0 && (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 8px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: LINK, display: 'inline-block' }} />
            Going Live Soon
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {upcomingRooms.map(r => (
              <Link key={r.id} href={`/rooms/${r.id}`} style={{ textDecoration: 'none', background: 'rgba(112,181,249,0.08)', border: '1px solid rgba(112,181,249,0.25)', borderRadius: 14, padding: '14px 20px', color: TEXT, minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.firstName} {r.lastName}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{r.role} @ {r.company}</div>
                <div style={{ color: LINK, fontSize: 12, marginTop: 6, fontWeight: 600 }}>live at {new Date(r.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === 'browse' && liveRooms.length > 0 && (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 8px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
            Live Now
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {liveRooms.map(r => (
              <Link key={r.id} href={`/rooms/${r.id}`} style={{ textDecoration: 'none', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 14, padding: '14px 20px', color: TEXT, minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{r.firstName} {r.lastName} · {r.role} @ {r.company}</div>
                <div style={{ color: '#F87171', fontSize: 12, marginTop: 6, fontWeight: 600 }}>join now →</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} variants={swapVariants} initial="hidden" animate="visible" exit="exit" transition={ease(DUR.fast)}>
      {tab === 'browse' ? (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search by name, role, company, topic..." aria-label="Search mentors by name, role, company, or topic"
              style={{ flex: 1, minWidth: 240, background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', color: TEXT, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="filter-scroll" style={{ display: 'flex', gap: 8, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
            {ALL_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? 'rgba(112,181,249,0.12)' : 'transparent',
                border: `1px solid ${filter === f ? 'rgba(112,181,249,0.4)' : BORDER}`,
                color: filter === f ? LINK : MUTED, padding: '6px 16px', borderRadius: 16,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
              }}>{f}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED }}>loading mentors...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: MUTED }}>
              <p>no mentors in this category yet. check back soon.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              <AnimatePresence mode="popLayout">
                {paged.map((mentor, i) => (
                  <motion.div key={mentor.id} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.05 }} whileHover={{ y: -6 }}
                    onClick={() => window.location.href = `/mentors/${mentor.id}`}
                    style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      {mentor.avatarData ? <PixelAvatar data={mentor.avatarData} size={46} /> : <div style={{ width: 46, height: 46, borderRadius: '50%', background: AVATARS[i % AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>{INITIALS(mentor)}</div>}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{mentor.firstName} {mentor.lastName}</div>
                        <div style={{ color: MUTED, fontSize: 13 }}>{mentor.role} @ {mentor.company}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {mentor.topics.split(',').filter(t => t.trim()).map(t => (
                        <span key={t} style={{ background: 'rgba(112,181,249,0.07)', border: '1px solid rgba(112,181,249,0.15)', color: LINK, padding: '3px 10px', borderRadius: 12, fontSize: 12 }}>{t.trim()}</span>
                      ))}
                    </div>
                      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, marginBottom: 20 }}>&quot;{mentor.bio}&quot;</p>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={e => { e.stopPropagation(); if (!user) { router.push('/sign-in'); } else if (rolesLoaded && !isSeeker) { router.push('/seekers/onboarding'); } else { setModal(mentor); } }}
                      style={{ width: '100%', background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.3)', color: LINK, padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      request a sip →
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {!loading && filtered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: page === 1 ? '#484F58' : MUTED, padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{String.fromCharCode(0x2190)} prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ background: page === n ? 'rgba(112,181,249,0.15)' : 'transparent', border: `1px solid ${page === n ? 'rgba(112,181,249,0.4)' : BORDER}`, color: page === n ? LINK : MUTED, width: 36, height: 36, borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: page === totalPages ? '#484F58' : MUTED, padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>next {String.fromCharCode(0x2192)}</button>
            </div>
          )}
        </section>
      ) : tab === 'live' ? (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 60px' }}>
          {liveRooms.length === 0 ? (
            <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '60px 40px', textAlign: 'center' }}>
              <p style={{ color: TEXT, fontWeight: 600, marginBottom: 8 }}>Nobody&apos;s live right now.</p>
              <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Rooms open through the day. Follow a mentor and you&apos;ll hear when they start one.</p>
              <button onClick={() => setTab('browse')} style={{ background: ACCENT, color: 'white', border: 'none', padding: '12px 26px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>browse mentors</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {liveRooms.map((r, i) => {
                const mins = Math.max(0, Math.round((Date.now() - new Date(r.startedAt).getTime()) / 60000));
                const topics = (r.topics || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listItem(i)}
                    whileHover={{ y: -3 }}
                    style={{ background: SURFACE, border: '1px solid rgba(220,38,38,0.22)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    {r.avatarData
                      ? <PixelAvatar data={r.avatarData} size={48} />
                      : <div style={{ width: 48, height: 48, borderRadius: '50%', background: ACCENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{r.firstName[0]}{r.lastName[0]}</div>}

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#F87171', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', padding: '2px 9px', borderRadius: 999 }}>
                          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
                          live {mins < 1 ? 'just started' : `${mins}m`}
                        </span>
                      </div>
                      <div style={{ color: MUTED, fontSize: 13 }}>{r.role} @ {r.company}</div>
                      {topics.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {topics.map(t => (
                            <span key={t} style={{ fontSize: 11, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '2px 8px' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link href={`/rooms/${r.id}`} style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#F87171', padding: '10px 22px', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>join queue →</Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 60px' }}>
          {!lookupDone ? (
            <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 40, textAlign: 'center' }}>
              {!user ? (
                <>
                <p style={{ color: MUTED, marginBottom: 20 }}>Sign in to see the sips you&apos;ve requested.</p>
                  <Link href="/sign-in" style={{ display: 'inline-block', background: ACCENT, color: 'white', padding: '13px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>sign in →</Link>
                </>
              ) : (
                <>
                <p style={{ color: MUTED, marginBottom: 20 }}>See the sips you&apos;ve requested as {user.primaryEmailAddress?.emailAddress}.</p>
                  {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleLookup} disabled={loadingLookup}
                    style={{ background: ACCENT, color: 'white', border: 'none', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: loadingLookup ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {loadingLookup ? 'looking up...' : 'see my sips →'}
                  </motion.button>
                </>
              )}
            </div>
          ) : (
            <div>
              {myFlags.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, padding: '18px 24px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#FBBF24', marginBottom: 4 }}>You&apos;ve been flagged {myFlags.length > 1 ? `${myFlags.length} times` : 'once'}</div>
                  <div style={{ color: MUTED, fontSize: 13 }}>Repeated flags can lead to a permanent ban. If you think this was a mistake, reach out to support.</div>
                </div>
              )}
              {streak && streak.currentStreak > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#F59E0B' }}>{streak.currentStreak} week streak</div>
                    <div style={{ color: MUTED, fontSize: 13 }}>longest: {streak.longestStreak} weeks · log a note after your next sip to keep it going</div>
                  </div>
                </div>
              )}

              {seekerId && (
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 28px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Your public profile</div>
                    <div style={{ color: MUTED, fontSize: 13 }}>Share this so people can see who you are, sips you&apos;ve had shared publicly appear here too.</div>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/seekers/${seekerId}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ background: copied ? 'rgba(91,219,138,0.15)' : ACCENT, color: copied ? '#5BDB8A' : 'white', border: copied ? '1px solid rgba(91,219,138,0.3)' : 'none', padding: '10px 22px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {copied ? 'copied' : 'copy link'}
                  </button>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                {[
                  { label: 'Total Sent', value: requests.length, color: LINK },
                  { label: 'Accepted', value: accepted.length, color: '#5BDB8A' },
                  { label: 'Pending', value: pending.length, color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'Space Mono' }}>{s.value}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {requests.length === 0 ? (
                <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '60px 40px', textAlign: 'center' }}>
                  <p style={{ color: MUTED, marginBottom: 24 }}>No sips found for this email.</p>
                  <button onClick={() => setTab('browse')} style={{ color: LINK, background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>browse mentors →</button>
                </div>
              ) : (
                <>
                <RequestFilterBar filter={sipList.filter} onChange={sipList.setFilter} counts={sipList.counts} />
                {sipList.filtered.length === 0 ? (
                  <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '36px 24px', textAlign: 'center', color: MUTED }}>
                    Nothing {sipList.filter === 'all' ? 'here' : sipList.filter} right now.
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sipList.shown.map((r, idx) => {
                    const s = STATUS_STYLE[r.status];
                    return (
                      <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={listItem(idx)}
                        style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, opacity: (r.status === 'declined' || r.status === 'cancelled') ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 16 }}>{r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : 'Mentor'}</div>
                            <div style={{ color: MUTED, fontSize: 13 }}>{r.mentor ? `${r.mentor.role} @ ${r.mentor.company}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 12, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>{s.label}</span>
                            <span style={{ color: MUTED, fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                            {r.status === 'cancelled' && r.cancelledBy && (
                              <div style={{ color: MUTED, fontSize: 11 }}>cancelled by {r.cancelledBy}</div>
                            )}
                          </div>
                        </div>

                        <p style={{ color: MUTED, fontSize: 14, margin: '0 0 16px' }}>&quot;{r.message}&quot;</p>

                        {r.status === 'accepted' && (
                          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {r.mentorNote && (
                              <div style={{ background: 'rgba(112,181,249,0.08)', border: '1px solid rgba(112,181,249,0.25)', borderRadius: 10, padding: '10px 14px' }}>
                                <p style={{ color: LINK, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Note from {r.mentor?.firstName}</p>
                                <p style={{ color: TEXT, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{r.mentorNote}</p>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <button onClick={() => toggleConsent(r.id, r.seekerConsentToShow)} disabled={togglingConsent === r.id}
                                style={{ background: r.seekerConsentToShow ? 'rgba(91,219,138,0.1)' : 'transparent', border: `1px solid ${r.seekerConsentToShow ? 'rgba(91,219,138,0.3)' : BORDER}`, color: r.seekerConsentToShow ? '#5BDB8A' : MUTED, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {r.seekerConsentToShow ? 'showing on profile' : 'show on profile'}
                              </button>
                              <button onClick={() => cancelRequest(r.id)} disabled={cancelling === r.id} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#F87171', padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{cancelling === r.id ? 'cancelling...' : 'cancel'}</button>
                              {safeExternalUrl(r.mentor?.calendarLink) && (
                                <a href={safeExternalUrl(r.mentor?.calendarLink)!} target="_blank" rel="noopener noreferrer"
                                  style={{ background: ACCENT, color: 'white', padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                                  book your sip →
                                </a>
                              )}
                              {r.originRoomId && (safeExternalUrl(r.mentor?.calendarLink) || r.mentor?.contactEmail) && (
                                <a href={safeExternalUrl(r.mentor?.calendarLink) ?? `mailto:${encodeURIComponent(r.mentor?.contactEmail ?? '')}?subject=${encodeURIComponent('Scheduling our 1:1')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{ background: ACCENT, color: 'white', padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                                  click here to schedule call →
                                </a>
                              )}
                            </div>

                            {!r.scheduledAt ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input type="datetime-local" value={scheduleDrafts[r.id] || ''} onChange={e => { setScheduleDrafts(d => ({ ...d, [r.id]: e.target.value })); setScheduleErrors(d => ({ ...d, [r.id]: '' })); }} aria-label="Scheduled date and time" style={{ background: BG, border: `1px solid ${scheduleErrors[r.id] ? '#F87171' : BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 12, fontFamily: 'inherit' }} />
                                  <button onClick={() => saveSchedule(r.id)} disabled={scheduling === r.id} style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: scheduling === r.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{scheduling === r.id ? 'saving...' : 'save time'}</button>
                                </div>
                                {scheduleErrors[r.id] && <span style={{ color: '#F87171', fontSize: 11 }}>{scheduleErrors[r.id]}</span>}
                              </div>
                            ) : (
                              <span style={{ color: MUTED, fontSize: 12 }}>scheduled: {new Date(r.scheduledAt).toLocaleString()}</span>
                            )}

                            {r.seekerFeedbackGiven ? (
                              <span style={{ color: '#5BDB8A', fontSize: 12 }}>feedback sent</span>
                            ) : (
                              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 4 }}>
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <button key={n} type="button" role="radio" aria-checked={(feedbackRatings[r.id] || 0) === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                                      onClick={() => setFeedbackRatings(d => ({ ...d, [r.id]: n }))}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 18, color: (feedbackRatings[r.id] || 0) >= n ? '#F59E0B' : 'rgba(255,255,255,0.2)' }}>★</button>
                                  ))}
                                </div>
                                <textarea value={feedbackComments[r.id] || ''} onChange={e => setFeedbackComments(d => ({ ...d, [r.id]: e.target.value }))}
                                  placeholder="optional comment..." aria-label="Optional feedback comment" rows={2} maxLength={1000}
                                  style={{ width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                <button onClick={() => submitFeedback(r.id)} disabled={submittingFeedback === r.id || !feedbackRatings[r.id]}
                                  style={{ alignSelf: 'flex-end', background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>                                  {submittingFeedback === r.id ? 'sending...' : 'submit feedback'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                )}
                <ShowMore hiddenCount={sipList.hiddenCount} expanded={sipList.expanded} onMore={sipList.showMore} onCollapse={sipList.collapse} />
                </>
              )}
            </div>
          )}
        </section>
      )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setModal(null); setModalError(''); } }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }}
              role="dialog" aria-modal="true" aria-label="Request a sip"
              style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: 36, width: '100%', maxWidth: 440 }}>
              <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>request a sip</div>
              <div style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>sending to {modal.firstName} {modal.lastName} · {modal.role} @ {modal.company}</div>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden style={{ margin: '0 auto 16px', display: 'block' }}><circle cx="12" cy="12" r="10" stroke="#5BDB8A" strokeWidth="1.5" opacity="0.35"/><path d="M7.5 12.4l3.1 3.1 6-6.4" stroke="#5BDB8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></motion.div>
                  <div style={{ color: '#5BDB8A', fontSize: 18, fontWeight: 600 }}>sent. they&apos;ll reach out soon.</div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="seekerReqName" style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>your name</label>
                    <input id="seekerReqName" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="seekerReqEmail" style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>your email</label>
                    <input id="seekerReqEmail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                      style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ marginBottom: 28 }}>
                  <label htmlFor="seekerReqMessage" style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>what&apos;s on your mind?</label>
                    <textarea id="seekerReqMessage" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3}
                      style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  {modalError && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 14 }}>
                      {modalError}
                    </div>
                  )}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit}
                    style={{ width: '100%', background: submitting ? '#1E3A5F' : ACCENT, color: 'white', border: 'none', padding: '13px 0', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {submitting ? 'sending...' : 'send it'}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppTour steps={SEEKER_TOUR_STEPS} open={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}
export default function Seekers() {
  return (
    <Suspense fallback={null}>
      <SeekersContent />
    </Suspense>
  );
}







