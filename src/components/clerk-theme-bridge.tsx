"use client";
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const DARK_ACCENT = '#3B82F6';
const DARK_BG = '#0A0E16';
const LIGHT_ACCENT = '#2563EB';
const LIGHT_BG = '#FFFFFF';

export function ClerkThemeBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLight = mounted && resolvedTheme === 'light';

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isLight ? undefined : [dark],
        variables: {
          colorPrimary: isLight ? LIGHT_ACCENT : DARK_ACCENT,
          colorBackground: isLight ? LIGHT_BG : DARK_BG,
          borderRadius: '10px',
        },
      } as any}
    >
      {children}
    </ClerkProvider>
  );
}