'use client';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ACCENT } from '@/lib/theme';

async function hasRole(endpoint: string) {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data;
  } catch {
    return false;
  }
}

export default function Logo({ style, children, size = 68 }: { style?: React.CSSProperties; children?: React.ReactNode; size?: number }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!isLoaded || !user) { router.push('/'); return; }

    const [mentorFlag, seekerFlag] = await Promise.all([
      hasRole('/api/mentor'),
      hasRole('/api/seeker'),
    ]);

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
      <img src="/logo.png" alt="Sip" style={{ width: size, height: size, objectFit: 'contain' }} />
      {children}
    </a>
  );
}