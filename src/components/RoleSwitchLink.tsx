'use client';
import { BG, BORDER, LINK } from '@/lib/theme'; 
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function RoleSwitchLink({ to, role, label, style }: { to: string; role: 'mentor' | 'seeker'; label: string; style?: React.CSSProperties }) {
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const failSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => { if (failSafeRef.current) clearTimeout(failSafeRef.current); };
  }, []);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (pathname === to) return;
    setSwitching(true);
    localStorage.setItem('sip_last_role', role);
    setTimeout(() => router.push(to), 650);
    failSafeRef.current = setTimeout(() => setSwitching(false), 4000);
  }

  return (
    <>
      <a href={to} onClick={handleClick} style={{ cursor: 'pointer', ...style }}>{label}</a>
      {mounted && createPortal(
        <AnimatePresence>
          {switching && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 9999, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="status" aria-live="polite">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                style={{ textAlign: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 32, height: 32, border: `3px solid ${BORDER}`, borderTopColor: LINK, borderRadius: '50%', margin: '0 auto 16px' }} />
                <div style={{ color: LINK, fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: 20, fontWeight: 700 }}>
                  switching to {role}...
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}