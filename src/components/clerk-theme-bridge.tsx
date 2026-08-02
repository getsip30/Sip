"use client";
import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';

/**
 * Applies the Sip appearance to every Clerk component in the tree, including the
 * ones with no page of their own (user button, profile modal, verification-code
 * steps). Sign in and sign up pass the same object explicitly rather than
 * relying on inheritance, so their layout overrides sit on top of an identical
 * base.
 */
export function ClerkThemeBridge({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}
