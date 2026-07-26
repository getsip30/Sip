'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const TOPICS = ['tech', 'startups', 'design', 'VC', 'AI/ML', 'product', 'finance', 'research'];

export default function Onboarding() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<'role' | 'topics'>('role');
  const [age, setAge] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [linkedinError, setLinkedinError] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const LINKEDIN_REGEX = /^(https?:\/\/)?(www\.)?linkedin\.com\/.+/i;

  async function handleFinishOnboarding() {
    if (linkedin && !LINKEDIN_REGEX.test(linkedin.trim())) {
      setLinkedinError('Please enter a valid LinkedIn profile URL.');
      return;
    }
    setLinkedinError('');
    setSubmitting(true);
    await fetch('/api/seeker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: age ? parseInt(age) : null, linkedin, interests: selectedTopic }),
    });
    setSubmitting(false);
    router.push(`/seekers${selectedTopic ? `?topic=${encodeURIComponent(selectedTopic)}` : ''}`);
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push('/'); return; }

    // Check if they already have a mentor profile
    fetch('/api/mentor').then(res => {
      if (res.ok) {
        res.json().then(data => {
          if (data && data.id) router.push('/dashboard');
          else setChecking(false);
        });
      } else if (res.status === 404) {
        setChecking(false);
      } else {
        setChecking(false);
      }
    }).catch(() => setChecking(false));
  }, [isLoaded, user, router]);

  if (!isLoaded || checking) return (
    <div style={{ background: '#0D1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: '#8B949E' }}>loading...</motion.div>
    </div>
  );
  if (step === 'topics') {
    return (
      <div style={{ background: '#0D1117', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#E6EDF3', fontFamily: 'Space Grotesk, sans-serif', padding: 24 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ textAlign: 'center', maxWidth: 480, width: '100%' }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: 26, fontWeight: 700, color: '#70B5F9', marginBottom: 32 }}>sip</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1.5, marginBottom: 12 }}>Quick intro</h1>
          <p style={{ color: '#8B949E', fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>Helps mentors know who they&apos;re talking to. Optional but recommended.</p>

          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#8B949E', display: 'block', marginBottom: 6 }}>Age</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 21"
              style={{ width: '100%', background: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#E6EDF3', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div style={{ textAlign: 'left', marginBottom: 28 }}>
            <label style={{ fontSize: 13, color: '#8B949E', display: 'block', marginBottom: 6 }}>LinkedIn profile</label>
            <input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/yourname"
              style={{ width: '100%', background: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#E6EDF3', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            {linkedinError && <div style={{ color: '#F87171', fontSize: 13, marginTop: 6 }}>{linkedinError}</div>}
          </div>

          <p style={{ color: '#8B949E', fontSize: 14, marginBottom: 14, textAlign: 'left' }}>What are you into? (pick one)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start', marginBottom: 32 }}>
            {TOPICS.map(t => (
              <motion.button key={t} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedTopic(t)}
                style={{ background: selectedTopic === t ? 'rgba(112,181,249,0.2)' : 'rgba(112,181,249,0.08)', border: `1px solid ${selectedTopic === t ? 'rgba(112,181,249,0.6)' : 'rgba(112,181,249,0.2)'}`, color: '#70B5F9', padding: '10px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t}
              </motion.button>
            ))}
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleFinishOnboarding} disabled={submitting}
            style={{ width: '100%', background: '#0A66C2', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {submitting ? 'saving...' : 'continue →'}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0D1117', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#E6EDF3', fontFamily: 'Space Grotesk, sans-serif', padding: 24 }}>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 26, fontWeight: 700, color: '#70B5F9', marginBottom: 32 }}>sip</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.5, marginBottom: 12 }}>
          Hey {user?.firstName || 'there'}
        </h1>
        <p style={{ color: '#8B949E', fontSize: 16, lineHeight: 1.7, marginBottom: 48 }}>
          What brings you to Sip?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <motion.button
            whileHover={{ scale: 1.03, borderColor: 'rgba(112,181,249,0.5)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/mentors/signup')}
            style={{ background: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '36px 24px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>I&apos;m a Mentor</div>
            <div style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6 }}>I want to open my door and help people by sharing what I know.</div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03, borderColor: 'rgba(91,219,138,0.5)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setStep('topics')}
            style={{ background: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '36px 24px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>I&apos;m Looking for a Sip</div>
            <div style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6 }}>I want to find someone to talk to and learn from their experience.</div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}