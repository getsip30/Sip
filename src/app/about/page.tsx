import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description: 'Sip exists because cold outreach doesn\'t work. Join a live queue and talk to a mentor right now. No scheduling, no waiting on replies.',
  openGraph: {
    title: 'About Sip',
    description: 'Real conversations, zero cold messages. No scheduling, no waiting on replies.',
    url: 'https://getsip.co/about',
  },
};

export default function About() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Space Grotesk', sans-serif", padding: '60px 20px' }}>
      <div id="main-content" style={{ maxWidth: 640, margin: '0 auto', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>About Sip</h1>
        <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
          Sip exists because cold outreach doesn&apos;t work. Most people trying to learn something new send messages that never get answered, or wait days for a scheduled call that could&apos;ve been a five-minute conversation.
        </p>
        <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
          We built a place where mentors show up when they&apos;re actually free, and seekers can join a live queue instead of sending a message into the void. No scheduling links. No waiting on replies. Just people who said yes to being here right now.
        </p>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14 }}>← back home</Link>
      </div>
    </div>
  );
}