'use client';
import { BG, SURFACE, TEXT, MUTED, ACCENT, LINK, CLAY } from '@/lib/theme';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRoles } from '@/hooks/useRoles';
import Logo from '@/components/Logo';
import PixelAvatar from '@/components/PixelAvatar';

type Mentor = {
  id: string; firstName: string; lastName: string; role: string; company: string;
  xp: number; sipCount: number; badges: string; isOpen: boolean; avatarData?: string;
};

const BADGE_META: Record<string, { label: string; color: string }> = {
  'first-sip':  { label: 'First Sip',  color: '#D97706' },
  'regular':    { label: 'Regular',    color: '#DC2626' },
  'veteran':    { label: 'Veteran',    color: CLAY },
  'legend':     { label: 'Legend',     color: '#0891B2' },
  'goat':       { label: 'GOAT',       color: '#059669' },
};

const AVATARS = [ACCENT, CLAY, '#059669', '#DC2626', '#D97706', '#0891B2'];
const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];

export default function Leaderboard() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const { isMentor, isSeeker, loaded: rolesLoaded } = useRoles();

  useEffect(() => {
    fetch('/api/mentor?leaderboard=true')
      .then(r => r.json())
      .then(data => { setMentors(data); setLoading(false); });
  }, []);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>

      {/* NAV */}
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 16px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {rolesLoaded && isMentor && <Link href="/dashboard" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>mentor dashboard</Link>}
          {rolesLoaded && isSeeker && <Link href="/seekers" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>seeker dashboard</Link>}
        </div>
      </motion.nav>

      <div id="main-content" style={{ maxWidth: 800, margin: '0 auto', padding: '90px 16px 60px' }}>

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: 56, textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, letterSpacing: -2.5, marginBottom: 12 }}>Leaderboard</h1>
          <p style={{ color: MUTED, fontSize: 16 }}>The people showing up the hardest. Earn XP when a sip is completed and both sides leave feedback.</p>
        </motion.div>

        {/* XP LEGEND */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {Object.entries(BADGE_META).map(([key, b]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, background: SURFACE, border: `1px solid ${b.color}40`, padding: '8px 16px', borderRadius: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color }} />
              <span style={{ fontSize: 13, color: MUTED }}>{b.label}</span>
            </div>
          ))}
        </motion.div>

        {/* LIST */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(n => (
              <motion.div key={n} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: n * 0.1 }}
                style={{ background: SURFACE, borderRadius: 16, height: 80 }} />
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <div style={{ textAlign: 'center', color: MUTED, padding: '80px 0' }}>
            <p>No mentors yet. Be the first to go live.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mentors.map((m, i) => (
              <motion.div key={m.id}
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.07 }}
                whileHover={{ borderColor: 'rgba(112,181,249,0.3)', x: 4 }}
                style={{ background: i < 3 ? `rgba(${i===0?'245,158,11':i===1?'148,163,184':'205,127,50'},0.06)` : SURFACE, border: `1px solid ${i < 3 ? `rgba(${i===0?'245,158,11':i===1?'148,163,184':'205,127,50'},0.25)` : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s', cursor: 'default' }}>

                {/* rank */}
                <div style={{ width: 36, textAlign: 'center', fontSize: i < 3 ? 18 : 14, color: i < 3 ? RANK_COLORS[i] : MUTED, fontWeight: 700, fontFamily: "var(--font-space-mono), 'Space Mono', monospace", flexShrink: 0 }}>
                  #{i + 1}
                </div>

                {/* avatar */}
                {m.avatarData ? <PixelAvatar data={m.avatarData} size={44} /> : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: AVATARS[i % AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {m.firstName[0]}{m.lastName[0]}
                </div>
                )}

                {/* info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{m.firstName} {m.lastName}</div>
                  <div style={{ color: MUTED, fontSize: 13 }}>{m.role} @ {m.company}</div>
                  {m.badges && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {m.badges.split(',').filter(Boolean).map(b => (
                        <span key={b} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BADGE_META[b]?.color}40`, color: '#EDEFF3' }}>
                          {BADGE_META[b]?.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* xp + sips */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? '#F59E0B' : LINK, fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{m.xp.toLocaleString()}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>XP</div>
                  <div style={{ color: '#5BDB8A', fontSize: 12, marginTop: 2 }}>{m.sipCount} sips</div>
                </div>

              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}