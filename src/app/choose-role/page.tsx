'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useRoles } from '@/hooks/useRoles';
import Logo from '@/components/Logo';
import { motion } from 'framer-motion';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT } from '@/lib/theme';

function IconGrad() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 8l10 5 8-4v6" stroke={ACCENT} strokeWidth="1.6" strokeLinejoin="round"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" stroke={ACCENT} strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function IconSearch() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={ACCENT} strokeWidth="1.6"/><path d="M21 21l-4.3-4.3" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

export default function ChooseRole() {
  const { user, isLoaded } = useUser();
  const { isMentor, isSeeker, loaded } = useRoles();
  const router = useRouter();

  // Only the single-role cases resolve to a destination on their own. Holding
  // both means the choice is genuinely the user's, and holding neither means
  // they signed up but have not onboarded into anything yet, so both of those
  // stay on this screen.
  useEffect(() => {
    if (!isLoaded || !loaded) return;
    if (!user) { router.push('/'); return; }
    if (isMentor && !isSeeker) { router.push('/dashboard'); return; }
    if (isSeeker && !isMentor) { router.push('/seekers'); return; }
  }, [isLoaded, loaded, user, isMentor, isSeeker, router]);

  const settled = isLoaded && loaded && !!user;
  const bothRoles = isMentor && isSeeker;
  const noRoles = !isMentor && !isSeeker;

  if (!settled || (!bothRoles && !noRoles)) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>loading...</div>
  );

  const go = (role: 'mentor' | 'seeker', href: string) => {
    localStorage.setItem('sip_last_role', role);
    router.push(href);
  };

  const card = (
    role: 'mentor' | 'seeker',
    href: string,
    icon: React.ReactNode,
    title: string,
    blurb: string
  ) => (
    <button onClick={() => go(role, href)}
      style={{ width: 220, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '32px 24px', color: TEXT, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <div style={{ marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{title}</div>
      <div style={{ color: MUTED, fontSize: 13 }}>{blurb}</div>
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ marginBottom: 40 }}><Logo /></div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>{bothRoles ? 'Continue as...' : 'Which side are you on?'}</h1>
      <p style={{ color: MUTED, fontSize: 14, marginBottom: 36 }}>
        {bothRoles
          ? 'You have both a mentor and seeker account.'
          : 'Pick one to set up. You can add the other later.'}
      </p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {bothRoles ? (
          <>
            {card('mentor', '/dashboard', <IconGrad />, 'Mentor', 'Manage requests, go live, answer asks')}
            {card('seeker', '/seekers', <IconSearch />, 'Seeker', 'Find mentors, join queues, ask questions')}
          </>
        ) : (
          <>
            {card('mentor', '/mentors/signup', <IconGrad />, 'Mentor', 'Open your door and take requests on your terms')}
            {card('seeker', '/seekers/onboarding', <IconSearch />, 'Seeker', 'Find someone who has done the thing you want to do')}
          </>
        )}
      </div>
    </motion.div>
  );
}