import { dark } from '@clerk/themes';

/**
 * Sip's palette, hardcoded rather than pulled from lib/theme. Those exports are
 * `var(--token)` strings and Clerk parses these values to derive its own scales
 * (hover states, alpha shades, focus rings), which it cannot do with a CSS
 * variable reference.
 */
const SIP = {
  card: '#121923',
  input: '#0B111A',
  text: '#EDEFF3',
  muted: '#8A93A3',
  border: 'rgba(255,255,255,0.10)',
  primary: '#3B82F6',
  link: '#70B5F9',
  success: '#5BDB8A',
  danger: '#F87171',
};

/**
 * One appearance for every Clerk surface: sign in, sign up, the password and
 * verification-code steps, and the user button/profile modals.
 *
 * The invisible-text bug this replaces came from `colorInput` being read as a
 * text color. It is the input *background*; `colorInputForeground` is the text.
 * Sign in and sign up set `colorInput: '#EDEFF3'`, which painted the field
 * near-white while the dark base theme kept the text `white`. Both halves are
 * set together here, and the `formFieldInput`/`otpCodeFieldInput` element rules
 * restate them so a future base-theme change cannot separate them again.
 *
 * `theme` is the v7 name for what used to be `baseTheme`. The old key was being
 * passed behind an `as any`, which is what hid the mismatch.
 */
export const clerkAppearance = {
  theme: [dark],
  variables: {
    colorPrimary: SIP.primary,
    colorPrimaryForeground: '#FFFFFF',
    colorBackground: SIP.card,
    colorForeground: SIP.text,
    colorMutedForeground: SIP.muted,
    colorInput: SIP.input,
    colorInputForeground: SIP.text,
    colorBorder: SIP.border,
    colorRing: SIP.primary,
    colorSuccess: SIP.success,
    colorDanger: SIP.danger,
    colorModalBackdrop: 'rgba(6,9,15,0.72)',
    fontFamily: "'Space Grotesk', sans-serif",
    borderRadius: '10px',
  },
  elements: {
    card: {
      backgroundColor: SIP.card,
      border: `1px solid ${SIP.border}`,
      boxShadow: 'none',
    },
    headerTitle: { color: SIP.text },
    headerSubtitle: { color: SIP.muted },
    formFieldLabel: { color: SIP.muted },

    // Background and text always move together. Setting one without the other is
    // what made these fields unreadable.
    formFieldInput: {
      backgroundColor: SIP.input,
      color: SIP.text,
      border: `1px solid ${SIP.border}`,
    },
    otpCodeFieldInput: {
      backgroundColor: SIP.input,
      color: SIP.text,
      border: `1px solid ${SIP.border}`,
    },
    formFieldInputShowPasswordButton: { color: SIP.muted },

    formFieldHintText: { color: SIP.muted, lineHeight: 1.5, marginTop: 6 },
    formFieldSuccessText: { color: SIP.success, lineHeight: 1.5, marginTop: 4 },
    formFieldWarningText: { lineHeight: 1.5, marginTop: 4 },
    formFieldErrorText: { color: SIP.danger, lineHeight: 1.5, marginTop: 4 },

    socialButtonsBlockButton: {
      backgroundColor: SIP.input,
      border: `1px solid ${SIP.border}`,
      color: SIP.text,
    },
    dividerLine: { backgroundColor: SIP.border },
    dividerText: { color: SIP.muted },
    footerActionLink: { color: SIP.link },
  },
};
