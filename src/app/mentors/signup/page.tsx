'use client';
import { BG, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/Logo';
import PixelAvatarPicker from '@/components/PixelAvatarPicker';

const TOPIC_OPTIONS = ['tech', 'startups', 'design', 'VC', 'AI/ML', 'product', 'finance', 'research', 'co-op', 'grad school'];

export default function MentorSignupPage() {
  return (
    <Suspense fallback={null}>
      <MentorSignup />
    </Suspense>
  );
}

function MentorSignup() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', role: '', company: '',
    bio: '', topics: [] as string[], calendarLink: '', contactEmail: '', availability: 'flexible',
    linkedin: '', showLinkedin: false, avatarData: '',
  });

  const set = (k: string, v: string | string[]) => setForm(f => ({ ...f, [k]: v }));
  const toggleTopic = (t: string) => setForm(f => ({ ...f, topics: f.topics.includes(t) ? f.topics.filter(x => x !== t) : [...f.topics, t] }));

  useEffect(() => {
    if (!user) return;
    fetch('/api/mentor').then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setForm(f => ({
          ...f,
          firstName: data.firstName, lastName: data.lastName, email: data.email,
          role: data.role, company: data.company, bio: data.bio,
          topics: data.topics ? data.topics.split(',').filter(Boolean) : [],
          calendarLink: data.calendarLink || '', contactEmail: data.contactEmail || '', availability: data.availability,
          linkedin: data.linkedin || '', showLinkedin: data.showLinkedin,
          avatarData: data.avatarData || '',
        }));
      } else {
        setForm(f => ({
          ...f,
          firstName: f.firstName || user.firstName || '',
          lastName: f.lastName || user.lastName || '',
          email: f.email || user.emailAddresses?.[0]?.emailAddress || '',
        }));
      }
    });
  }, [user]);
  
  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, topics: form.topics.join(','), ref }),
      });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Something went wrong'); setLoading(false); return; }
      router.push('/dashboard');
    } catch { setError('Something went wrong. Try again.'); setLoading(false); }
  }

  const input: React.CSSProperties = { width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: TEXT, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label: React.CSSProperties = { fontSize: 13, color: MUTED, display: 'block', marginBottom: 8, fontWeight: 500 };

  const stepVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>

      {/* NAV */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 16px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Logo />
        <Link href="/dashboard" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>← back to dashboard</Link>
      </motion.nav>

      <div id="main-content" style={{ maxWidth: 860, margin: '0 auto', padding: '90px 16px 60px' }}>

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} style={{ marginBottom: 48 }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(112,181,249,0.08)', border: '1px solid rgba(112,181,249,0.2)', padding: '6px 16px', borderRadius: 20, fontSize: 12, color: LINK, marginBottom: 20, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            Mentor Signup
          </motion.div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, marginBottom: 12 }}>
            Open Your Door.<br />
            <span style={{ color: '#70B5F9' }}>Change Someone&apos;s Path.</span>
          </h1>
          <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.7 }}>
            You know something someone needs to hear. List yourself, stay in control, show up when you want to.
          </p>
        </motion.div>

        {/* STEP PROGRESS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[1, 2, 3].map(s => (
            <motion.div key={s} animate={{ background: step >= s ? ACCENT : BORDER }} transition={{ duration: 0.3 }}
              style={{ flex: 1, height: 3, borderRadius: 4 }} />
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} style={{ color: MUTED, fontSize: 12, marginBottom: 36 }}>
          step {step} of 3
        </motion.div>

        {!isLoaded ? null : !user ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '60px 0' }}>
            
            <p style={{ color: MUTED, marginBottom: 24 }}>Sign in first to create your mentor profile</p>
            <Link href="/sign-in">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} style={{ background: ACCENT, color: 'white', border: 'none', padding: '12px 32px', borderRadius: 24, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>sign in to continue</motion.button>
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">

            {/* STEP 1 */}
            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                  <PixelAvatarPicker value={form.avatarData} onChange={v => set('avatarData', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={label} htmlFor="firstName">First name</label>
                    <input id="firstName" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="your first name" style={input} />
                  </div>
                  <div>
                    <label style={label} htmlFor="lastName">Last name</label>
                    <input id="lastName" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="your last name" style={input} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="mentorEmail">Email</label>
                  <input id="mentorEmail" value={form.email} type="email" readOnly disabled style={{ ...input, opacity: 0.6, cursor: 'not-allowed' }} />
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
                    This is your account email. Change it from your account settings. Use the contact email below if you want seekers to reach you somewhere else.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={label} htmlFor="role">Your role</label>
                    <input id="role" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. SWE, Founder, PM" style={input} />
                  </div>
                  <div>
                    <label style={label} htmlFor="company">Company</label>
                    <input id="company" value={form.company} onChange={e => set('company', e.target.value)} placeholder="where you work" style={input} />
                  </div>
                </div>
                {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <motion.button
                  whileHover={{ scale: 1.02, background: '#0856A8' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { if (!form.firstName || !form.lastName || !form.role || !form.company) { setError('Please fill in all fields.'); return; } setError(''); setStep(2); }}
                  style={{ width: '100%', background: ACCENT, color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                  next →
                </motion.button>
                <button
                  disabled={loading}
                  onClick={() => { if (!form.firstName || !form.lastName || !form.role || !form.company) { setError('Please fill in all fields.'); return; } setError(''); handleSubmit(); }}
                  style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'saving...' : "finish later, I'll add my bio and calendar from the dashboard"}
                </button>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={label} htmlFor="bio">Your one-liner bio</label>
                  <textarea id="bio" value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="what do you actually want to talk about? be real, not corporate." rows={3} style={{ ...input, resize: 'none' }} />
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{form.bio.length}/500 chars</div>
                </div>
                <div style={{ marginBottom: 28 }}>
                <label style={label}>Topics you&apos;re open to discuss</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TOPIC_OPTIONS.map(t => (
                      <motion.button key={t} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => toggleTopic(t)}
                        style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid', borderColor: form.topics.includes(t) ? ACCENT : BORDER, background: form.topics.includes(t) ? 'rgba(10,102,194,0.2)' : 'transparent', color: form.topics.includes(t) ? LINK : MUTED, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                        {t}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setStep(1)} style={{ flex: 1, background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: 12, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>← back</motion.button>
                  <motion.button whileHover={{ scale: 1.02, background: '#0856A8' }} whileTap={{ scale: 0.97 }} onClick={() => { if (!form.bio || form.topics.length === 0) { setError('Add a bio and at least one topic.'); return; } setError(''); setStep(3); }} style={{ flex: 2, background: ACCENT, color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>next →</motion.button>
                </div>
                {error && <div style={{ color: '#F87171', fontSize: 13, marginTop: 12 }}>{error}</div>}
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="calendarLink">Calendar link (optional)</label>
                  <input id="calendarLink" value={form.calendarLink} onChange={e => set('calendarLink', e.target.value)} placeholder="calendly.com/yourname" style={input} />
                  {form.calendarLink && !/^(https?:\/\/)?(www\.)?calendly\.com\/.+/i.test(form.calendarLink.trim()) && (
                    <div style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>Must be a calendly.com link.</div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="contactEmail">Contact email (optional)</label>
                  <input id="contactEmail" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} type="email" placeholder="you@example.com" style={input} />
                  {form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()) && (
                    <div style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>Enter a valid email.</div>
                  )}
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
                    Add a calendar link, an email, or both. This is what seekers get when you accept a request. If you add both, you&apos;ll choose which to share each time you accept.
                  </div>
                  {!form.calendarLink && !form.contactEmail && (
                    <div style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>Add at least a calendar link or an email.</div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="linkedin">LinkedIn profile (optional)</label>
                  <input id="linkedin" value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" style={input} />
                  {form.linkedin && !/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/i.test(form.linkedin.trim()) && (
                    <div style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>Please enter a valid LinkedIn profile URL.</div>
                  )}
                </div>
                <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="showLinkedin" checked={form.showLinkedin} onChange={e => setForm(f => ({ ...f, showLinkedin: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: ACCENT, cursor: 'pointer' }} />
                  <label htmlFor="showLinkedin" style={{ fontSize: 13, color: MUTED, cursor: 'pointer' }}>Show my LinkedIn on my public profile</label>
                </div>
                <div style={{ marginBottom: 32 }}>
                  <label style={label}>Availability vibe</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['flexible', 'weekends only', 'evenings only', 'by request'].map(a => (
                      <motion.button key={a} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => set('availability', a)}
                        style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid', borderColor: form.availability === a ? ACCENT : BORDER, background: form.availability === a ? 'rgba(10,102,194,0.2)' : 'transparent', color: form.availability === a ? LINK : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                        {a}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 14, marginBottom: 16 }}>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div style={{ display: 'flex', gap: 12 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setStep(2)} style={{ flex: 1, background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: 12, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>← back</motion.button>
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02, background: loading ? '#1E3A5F' : '#0856A8' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={loading || (!form.calendarLink && !form.contactEmail) || (!!form.calendarLink && !/^(https?:\/\/)?(www\.)?calendly\.com\/.+/i.test(form.calendarLink.trim())) || (!!form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) || (!!form.linkedin && !/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/i.test(form.linkedin.trim()))}
                    style={{ flex: 2, background: loading ? '#1E3A5F' : ACCENT, color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                    {loading ? (
                      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>saving...</motion.span>
                    ) : 'go live'}
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}