"use client";
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

const DARK_ACCENT = '#3B82F6';
const DARK_BG = '#0A0E16';

export function ClerkThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: [dark],
        variables: {
          colorPrimary: DARK_ACCENT,
          colorBackground: DARK_BG,
          borderRadius: '10px',
        },
      } as any}
    >
      {children}
    </ClerkProvider>
  );
}