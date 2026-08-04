'use client';
import { BG, SURFACE, TEXT, MUTED, LINK } from '@/lib/theme';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import PixelAvatar from '@/components/PixelAvatar';

type Sip = { mentorId: string; firstName: string; lastName: string; role: string; company: string };
type Seeker = {
  id: string; firstName: string; lastName: string; age?: number | null;
  linkedin?: string; interests: string; currentStreak: number; longestStreak: number;
  sips: Sip[]; avatarData?: string;
};

export default function SeekerProfile() {
  const { id } = useParams();
  const [seeker, setSeeker] = useState<Seeker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/seeker/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setSeeker(data); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: MUTED }}>loading...</motion.div>
    </div>
  );

  if (!seeker) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: MUTED }}>Seeker not found.</p>
      <Link href="/" style={{ color: LINK, textDecoration: 'none' }}>← back to directory</Link>
    </div>
  );

  const interests = seeker.interests ? seeker.interests.split(',').map(i => i.trim()).filter(Boolean) : [];

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 16px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Logo />
        <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← back</button>
      </motion.nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '90px 16px 60px' }}>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 'clamp(20px,5vw,40px)', marginBottom: 24 }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
            {seeker.avatarData ? <PixelAvatar data={seeker.avatarData} size={72} /> : (
            <motion.div whileHover={{ scale: 1.06 }} style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #0891B2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24, flexShrink: 0 }}>
              {seeker.firstName[0]}{seeker.lastName[0]}
            </motion.div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, margin: 0, marginBottom: 8 }}>{seeker.firstName} {seeker.lastName}</h1>
            </div>
          </div>

          {interests.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
              {interests.map(i => (
                <span key={i} style={{ background: 'rgba(112,181,249,0.07)', border: '1px solid rgba(112,181,249,0.15)', color: LINK, padding: '5px 14px', borderRadius: 14, fontSize: 13 }}>{i}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ background: BG, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B', fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{seeker.currentStreak}</div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Week Streak</div>
            </div>
            <div style={{ background: BG, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: LINK, fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{seeker.sips.length}</div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Sips Shared</div>
            </div>
          </div>
        </motion.div>

        {seeker.sips.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
            style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 'clamp(20px,5vw,40px)' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Sips {seeker.firstName} has had</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {seeker.sips.map(s => (
                <Link key={s.mentorId} href={`/mentors/${s.mentorId}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: BG, borderRadius: 14, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
                      <div style={{ color: MUTED, fontSize: 13 }}>{s.role} @ {s.company}</div>
                    </div>
                    <span style={{ color: LINK, fontSize: 13 }}>view →</span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}