// src/app/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoles } from '@/hooks/useRoles';
import Logo from '@/components/Logo';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, AVATARS } from '@/lib/theme';

type Mentor = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  topics: string;
  bio: string;
  isOpen: boolean;
  availability: string;
};

const INITIALS = (m: Mentor) => `${m.firstName[0]}${m.lastName[0]}`;

const WORDS = ['no cold DMs.', 'no scheduling links.', 'no gatekeeping.', 'no waiting.'];
type AIMatch = { id: string; firstName: string; lastName: string; role: string; company: string; reason: string };

function IconBolt() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" fill="none"/></svg>;
}
function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={MUTED} strokeWidth="2"/><path d="M21 21l-4.3-4.3" stroke={MUTED} strokeWidth="2" strokeLinecap="round"/></svg>;
}
function IconArrow({ color = TEXT }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconExternal() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M7 7h10v10" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconCup() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" stroke={MUTED} strokeWidth="1.6"/><path d="M17 9h2a2.5 2.5 0 010 5h-2" stroke={MUTED} strokeWidth="1.6"/><path d="M7 3c0 1-1 1-1 2M11 3c0 1-1 1-1 2M15 3c0 1-1 1-1 2" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
function IconEnvelope() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={MUTED} strokeWidth="1.6"/><path d="M3 7l9 6 9-6" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
function IconHandshake() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 5 3 5-3 4 3-4 5-5-3-5 3-4-4z" stroke={MUTED} strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}

export default function HomeClient() {
  const { user } = useUser();
  const router = useRouter();
  const { isMentor, isSeeker, loaded: rolesLoaded } = useRoles();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Mentor | null>(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [modalError, setModalError] = useState('');
  const [count, setCount] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiMatches, setAiMatches] = useState<AIMatch[] | null>(null);
  const [matching, setMatching] = useState(false);
  const TEASER_LIMIT = 6;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.firstName) setForm(f => ({ ...f, name: user.firstName! }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.emailAddresses?.[0]) setForm(f => ({ ...f, email: user.emailAddresses[0].emailAddress }));
  }, [user]);

  useEffect(() => {
    if (mentors.length === 0) return;
    let n = 0;
    const target = mentors.length;
    const t = setInterval(() => { n += 1; setCount(Math.min(n, target)); if (n >= target) clearInterval(t); }, 40);
    return () => clearInterval(t);
  }, [mentors.length]);

  useEffect(() => {
    const t = setInterval(() => setWordIndex(i => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [liveRooms, setLiveRooms] = useState<{ id: string; title: string; firstName: string; lastName: string; role: string; company: string; }[]>([]);
  const [noMatchInterest, setNoMatchInterest] = useState<string | null>(null);

  const fetchMentors = useCallback(async () => {
    const res = await fetch('/api/mentor?leaderboard=true');
    if (res.ok) {
      const data: Mentor[] = await res.json();
      setMentors(data.filter(m => m.isOpen));
    }
    setLoading(false);
  }, []);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchMentors(); }, [fetchMentors]);

  const ALL_FILTERS = ['all', 'tech', 'startups', 'design', 'VC', 'AI/ML', 'product', 'finance', 'research'];
  const filtered = mentors.filter(m => {
    const matchFilter = filter === 'all' || m.topics.toLowerCase().includes(filter.toLowerCase());
    const q = search.toLowerCase();
    const matchSearch = !q || m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.company.toLowerCase().includes(q) || m.topics.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
  const teaserMentors = filtered.slice(0, TEASER_LIMIT);

  async function handleAIMatch() {
    if (!aiQuery.trim()) return;
    setMatching(true);
    setAiMatches(null);
    const res = await fetch('/api/match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: aiQuery }),
    });
    if (res.ok) { const data = await res.json(); setAiMatches(data.matches); }
    setMatching(false);
  }

  async function handleInstantSip() {
    if (!user) { router.push('/sign-in'); return; }
    if (rolesLoaded && !isSeeker) { router.push('/seekers/onboarding'); return; }

    const openMentors = mentors.filter(m => m.isOpen);
    if (openMentors.length === 0) { alert("no one's open right now, check back in a bit"); return; }

    const seekerRes = await fetch('/api/seeker');
    const seeker = seekerRes.ok ? await seekerRes.json() : null;
    const interests = seeker?.interests ? seeker.interests.split(',').map((i: string) => i.trim().toLowerCase()).filter(Boolean) : [];

    if (interests.length === 0) {
      const pick = openMentors[Math.floor(Math.random() * openMentors.length)];
      setModal(pick);
      return;
    }

    const matches = openMentors.filter(m =>
      interests.some((i: string) => m.topics.toLowerCase().includes(i))
    );

    if (matches.length > 0) {
      const pick = matches[Math.floor(Math.random() * matches.length)];
      setModal(pick);
    } else {
      setNoMatchInterest(interests[0]);
    }
  }

  function handleInstantSipFallback() {
    const openMentors = mentors.filter(m => m.isOpen);
    const pick = openMentors[Math.floor(Math.random() * openMentors.length)];
    setModal(pick);
    setNoMatchInterest(null);
  }

  async function handleSubmit() {
    if (!form.name || !form.email || !form.message || !modal) return;
    setSubmitting(true);
    setModalError('');
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: modal.id, seekerName: form.name, seekerEmail: form.email, message: form.message }),
    });
    if (res.ok) {
      setSent(true);
      setTimeout(() => { setModal(null); setSent(false); setForm(f => ({ ...f, message: '' })); }, 2200);
    } else {
      const data = await res.json();
      setModalError(data.error || 'Something went wrong');
    }
    setSubmitting(false);
  }

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: BG, minHeight: '100vh', color: TEXT, overflowX: 'hidden', WebkitFontSmoothing: 'antialiased' }}>

      {/* NAV */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 20px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: scrolled ? 'rgba(10,14,22,0.95)' : 'rgba(10,14,22,0.5)', backdropFilter: 'blur(20px)', borderBottom: scrolled ? `1px solid ${BORDER}` : '1px solid transparent', transition: 'background 0.3s, border-color 0.3s' }}>
        <Logo />
        {!user && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link href="/leaderboard" className="desktop-only" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>leaderboard</Link>
            <Link href="/mentors/signup" className="desktop-only" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>become a mentor</Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link href="/sign-in" style={{ background: TEXT, color: BG, padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'block' }}>sign in</Link>
            </motion.div>
          </div>
        )}
      </motion.nav>

      {/* HERO */}
      <section style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '100px 20px 40px', maxWidth: 1100, margin: '0 auto', textAlign: 'left' }}>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, marginBottom: 28, letterSpacing: 0.3 }}>
          <span style={{ width: 6, height: 6, background: '#4CAF7D', borderRadius: '50%', display: 'inline-block' }} />
          {count} mentors open right now
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          style={{ fontSize: 'clamp(44px, 6vw, 80px)', fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.5, margin: '0 0 20px', color: TEXT, maxWidth: 780 }}>
          Real mentors,<br />talking right now -
          <span style={{ display: 'inline-block', height: '1.05em', overflow: 'hidden', verticalAlign: 'bottom', marginLeft: 12 }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIndex}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -24, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                style={{ display: 'inline-block', color: ACCENT }}>
                {WORDS[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{ fontSize: 17, color: MUTED, maxWidth: 480, lineHeight: 1.7, marginBottom: 36 }}>
          People who actually know their stuff, already open to talking. Click, connect, learn - no scheduling back-and-forth.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.5 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {user ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {!rolesLoaded ? (
                <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 178, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
              ) : (
                <>
                  {isMentor && isSeeker && <Link href="/choose-role" style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>go to dashboard <IconArrow color="#fff" /></Link>}
                  {isMentor && !isSeeker && <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>go to dashboard <IconArrow color="#fff" /></Link>}
                  {isSeeker && !isMentor && (
                    <>
                      <Link href="/seekers" style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>find your sip <IconArrow color="#fff" /></Link>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleInstantSip} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><IconBolt /> instant sip</motion.button>
                    </>
                  )}
                  {!isMentor && !isSeeker && <Link href="/seekers" style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>find your sip <IconArrow color="#fff" /></Link>}
                </>
              )}
            </div>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => document.getElementById('mentors')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                find your sip <IconArrow color="#fff" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleInstantSip}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <IconBolt /> instant sip
              </motion.button>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link href="/mentors/signup" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>join as mentor <IconArrow color={MUTED} /></Link>
              </motion.div>
            </>
          )}
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '20px 20px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 44 }}>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, marginBottom: 10 }}>How it works</h2>
          <p style={{ color: MUTED, fontSize: 15 }}>Three steps. No cringe.</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          {[
            { icon: <IconCup />, title: 'Pick someone real', body: 'Browse people who actually said yes to being here. Every card is a green light.' },
            { icon: <IconEnvelope />, title: 'Send your ask', body: "One short form. Your name, your email, what's on your mind. That's it." },
            { icon: <IconHandshake />, title: 'Show up', body: 'They get an email. You get a reply. You both get on a call.' },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              style={{ background: SURFACE, padding: '32px 28px' }}>
              <div style={{ marginBottom: 20 }}>{step.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{step.title}</div>
              <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.65 }}>{step.body}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* WHY SIP */}
      <section style={{ padding: '20px 20px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 44 }}>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, marginBottom: 10 }}>Why not just DM someone on LinkedIn?</h2>
          <p style={{ color: MUTED, fontSize: 15, maxWidth: 560 }}>Because that message sits unread for three weeks, if it gets a reply at all. Here&apos;s what&apos;s actually different.</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          {[
            { title: 'They already said yes', body: 'Every person on Sip opted in to being reached out to right now. You\'re not interrupting anyone.' },
            { title: 'No scheduling back-and-forth', body: 'One short form instead of five emails trying to find a time that works for both of you.' },
            { title: 'You know exactly what happens next', body: 'They get your ask by email. If they say yes, you get on a call. No ambiguity about whether it worked.' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              style={{ background: SURFACE, padding: '32px 28px' }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{item.title}</div>
              <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.65 }}>{item.body}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* DIRECTORY */}
      {liveRooms.length > 0 && (
        <section style={{ padding: '0 20px 40px', maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 8, height: 8, borderRadius: '50%', background: '#D9534F', display: 'inline-block' }} />
            Live now
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {liveRooms.map(r => (
              <Link key={r.id} href={user ? `/rooms/${r.id}` : '/sign-in'} onClick={e => { if (!user) { e.preventDefault(); router.push('/sign-in'); } }} style={{ textDecoration: 'none', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 20px', color: TEXT, minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{r.firstName} {r.lastName} · {r.role} @ {r.company}</div>
                <div style={{ color: '#D9534F', fontSize: 12, marginTop: 6, fontWeight: 600 }}>join now</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="mentors" style={{ padding: '20px 20px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, marginBottom: 8 }}>Who&apos;s open right now</h2>
          <p style={{ color: MUTED, marginBottom: 32, fontSize: 15 }}>Every person here said yes to showing up. No chasing required.</p>
        </motion.div>

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: 16, maxWidth: 480 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search by name, role, company, topic..."
            style={{ width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '13px 20px 13px 44px', color: TEXT, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}><IconSearch /></span>
        </div>

        {/* AI MATCH */}
        <div style={{ marginBottom: 24, maxWidth: 480 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAIMatch()}
              placeholder="or describe what you need, e.g. 'advice switching into product'"
              style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '13px 18px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <button onClick={handleAIMatch} disabled={matching} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '0 22px', fontSize: 14, fontWeight: 600, cursor: matching ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {matching ? '...' : 'match me'}
            </button>
          </div>
          {aiMatches && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aiMatches.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 14 }}>no strong matches right now - try the directory below.</p>
              ) : (
                aiMatches.map(m => (
                  <div key={m.id} onClick={() => window.location.href = `/mentors/${m.id}`} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 20px', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.firstName} {m.lastName} · {m.role} @ {m.company}</div>
                    <div style={{ color: ACCENT, fontSize: 13, marginTop: 4 }}>{m.reason}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* FILTERS */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
          {ALL_FILTERS.map(f => (
            <motion.button
              key={f}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(f)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid', borderColor: filter === f ? ACCENT : BORDER, background: filter === f ? 'rgba(59,130,246,0.1)' : 'transparent', color: filter === f ? ACCENT : MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
              {f}
            </motion.button>
          ))}
        </motion.div>

        {/* CARDS */}
        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 80 }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, height: 220 }}>
                <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ width: '60%', height: 16, background: 'rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 12 }} />
                <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }} style={{ width: '40%', height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 20 }} />
                <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }} style={{ width: '100%', height: 60, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
              </div>
            ))}
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 0', color: MUTED, marginBottom: 80 }}>
            <p>no mentors in this category yet. check back soon.</p>
          </motion.div>
        ) : (
          <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
            <AnimatePresence mode="popLayout">
              {teaserMentors.map((mentor, i) => (
                <motion.div
                  key={mentor.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  onClick={() => window.location.href = `/mentors/${mentor.id}`}
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: AVATARS[i % AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, color: '#fff' }}>{INITIALS(mentor)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{mentor.firstName} {mentor.lastName}</div>
                      <div style={{ color: MUTED, fontSize: 13 }}>{mentor.role} @ {mentor.company}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600 }}>● open</span>
                      <span style={{ fontSize: 10, color: MUTED, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>{mentor.availability}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {mentor.topics.split(',').map(t => (
                      <span key={t} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: MUTED, padding: '3px 10px', borderRadius: 8, fontSize: 12 }}>{t.trim()}</span>
                    ))}
                  </div>
                  <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>&quot;{mentor.bio}&quot;</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={e => { e.stopPropagation(); if (!user) { router.push('/sign-in'); } else if (rolesLoaded && !isSeeker) { router.push('/seekers/onboarding'); } else { setModal(mentor); } }}
                      style={{ flex: 1, background: 'transparent', border: `1px solid ${ACCENT}`, color: ACCENT, padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      request a sip
                    </motion.button>
                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                      <Link href={`/mentors/${mentor.id}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, textDecoration: 'none' }}><IconExternal /></Link>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '32px 36px', marginBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>These are just the top mentors right now</div>
              <div style={{ color: MUTED, fontSize: 14 }}>Sign up free to see everyone open, filter by topic, and request a sip.</div>
            </div>
            <Link href="/sign-up" style={{ background: ACCENT, color: '#fff', padding: '13px 26px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              see all mentors
            </Link>
          </motion.div>
        )}
      </section>

      {/* NO MATCH PROMPT */}
      <AnimatePresence>
        {noMatchInterest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setNoMatchInterest(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 36, width: '100%', maxWidth: 400, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>no one in {noMatchInterest} is open right now</div>
              <p style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>want to talk to someone from a different area instead?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setNoMatchInterest(null)} style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, padding: '12px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>no thanks</button>
                <button onClick={handleInstantSipFallback} style={{ flex: 1, background: ACCENT, border: 'none', color: '#fff', padding: '12px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>sure, find someone</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setModal(null); setModalError(''); } }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 36, width: '100%', maxWidth: 440 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>request a sip</div>
              <div style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>sending to {modal.firstName} {modal.lastName} · {modal.role} @ {modal.company}</div>
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ color: '#4CAF7D', fontSize: 18, fontWeight: 600 }}>sent. they&apos;ll reach out soon.</div>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>your name</label>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="what do people call you?" autoComplete="name" name="name" style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>your email</label>
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="so they can reach back" type="email" autoComplete="email" name="email" style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ marginBottom: 28 }}>
                      <label style={{ fontSize: 13, color: MUTED, display: 'block', marginBottom: 6 }}>what&apos;s on your mind?</label>
                      <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="one or two sentences - what are you trying to figure out?" rows={3} style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px 14px', color: TEXT, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    {modalError && (
                      <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 16 }}>
                        {modalError}
                      </div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      style={{ width: '100%', background: submitting ? 'rgba(59,130,246,0.4)' : ACCENT, color: '#fff', border: 'none', padding: '13px 0', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                      {submitting ? 'sending...' : 'send it'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAQ */}
      <section style={{ padding: '60px 20px', maxWidth: 760, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, marginBottom: 10 }}>Questions</h2>
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[
            { q: 'Is Sip free?', a: 'Yes. There\'s no cost to find a mentor or to become one.' },
            { q: 'What if no one\'s open right now?', a: 'You can still send a request, or try the AI match to get pointed toward someone relevant even if they\'re offline.' },
            { q: 'Do I need to be an expert to be a mentor?', a: 'No. If you\'ve got real experience in something and are willing to talk about it, that\'s enough.' },
            { q: 'Is my information private?', a: 'We don\'t sell your data, and you control what\'s shown on your profile. See our Privacy Policy for details.' },
          ].map(item => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{item.q}</div>
              <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.65 }}>{item.a}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '20px 20px 80px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '60px 40px' }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -1, marginBottom: 12 }}>Stop drafting the perfect cold DM.</h2>
          <p style={{ color: MUTED, fontSize: 15, marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>Someone&apos;s open right now. Go find them.</p>
          <Link href="/#mentors" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            find your sip <IconArrow color="#fff" />
          </Link>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '56px 20px 40px', color: MUTED }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40, marginBottom: 40 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ marginBottom: 12 }}><Logo /></div>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>Live mentorship, no scheduling, no cold DMs. Just people who showed up and said yes.</p>
          </div>
          <div style={{ display: 'flex', gap: 60, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>Product</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <Link href="/#mentors" style={{ color: MUTED, textDecoration: 'none' }}>Find a mentor</Link>
                <Link href="/mentors/signup" style={{ color: MUTED, textDecoration: 'none' }}>Become a mentor</Link>
                <Link href="/leaderboard" style={{ color: MUTED, textDecoration: 'none' }}>Leaderboard</Link>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>Company</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <Link href="/about" style={{ color: MUTED, textDecoration: 'none' }}>About</Link>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>Legal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <Link href="/privacy" style={{ color: MUTED, textDecoration: 'none' }}>Privacy Policy</Link>
                <Link href="/terms" style={{ color: MUTED, textDecoration: 'none' }}>Terms of Service</Link>
                <Link href="/conduct" style={{ color: MUTED, textDecoration: 'none' }}>Code of Conduct</Link>
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', borderTop: `1px solid ${BORDER}`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
          <span>© {new Date().getFullYear()} Sip. All rights reserved.</span>
          <span>Made for the curious ones.</span>
        </div>
      </footer>
    </div>
  );
}