// src/components/Logo.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useRoles } from '@/hooks/useRoles';
import { ACCENT } from '@/lib/theme';

export default function Logo({ style, children }: { style?: React.CSSProperties; children?: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { isMentor, isSeeker, loaded } = useRoles();
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!isLoaded || !user) { router.push('/'); return; }

    let mentorFlag = isMentor;
    let seekerFlag = isSeeker;

    if (!loaded) {
      const [m, s] = await Promise.all([
        fetch('/api/mentor').then(r => r.json()).then(d => !!d),
        fetch('/api/seeker').then(r => r.json()).then(d => !!d),
      ]);
      mentorFlag = m;
      seekerFlag = s;
    }

    const lastRole = typeof window !== 'undefined' ? localStorage.getItem('sip_last_role') : null;
    if (lastRole === 'seeker' && seekerFlag) { router.push('/seekers'); return; }
    if (lastRole === 'mentor' && mentorFlag) { router.push('/dashboard'); return; }
    if (mentorFlag) { router.push('/dashboard'); return; }
    if (seekerFlag) { router.push('/seekers'); return; }
    router.push('/');
  }

  return (
    <a href="/" onClick={handleClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Space Mono', fontSize: 28, fontWeight: 700, color: ACCENT, letterSpacing: -1, textDecoration: 'none', cursor: 'pointer', ...style }}>
      <img src="/logo.png" alt="Sip" style={{ width: 52, height: 52, objectFit: 'contain' }} />
      {children}
    </a>
  );
}