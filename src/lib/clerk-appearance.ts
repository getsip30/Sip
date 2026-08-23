import { dark } from '@clerk/themes';

/**
 * Sip's palette, hardcoded rather than pulled from lib/theme. Those exports are
 * `var(--token)` strings and Clerk parses these values to derive its own scales
 * (hover states, alpha shades, focus rings), which it cannot do with a CSS
 * variable reference.
 *
 * The values below are the literal ones from the `:root` block in globals.css.
 * They had drifted: `primary` was #3B82F6 against a real `--accent` of #2563EB,
 * `input` was #0B111A against a real `--bg` of #0A0E16, and `border` was 0.10
 * against a real 0.08. Small on their own, and together they were most of why a
 * Clerk surface never quite looked like the page it opened on.
 */
const SIP = {
  bg: '#0A0E16',
  card: '#121923',
  input: '#0A0E16',
  text: '#EDEFF3',
  muted: '#8A93A3',
  border: 'rgba(255,255,255,0.08)',
  primary: '#2563EB',
  primaryHover: '#1D4FD8',
  link: '#70B5F9',
  success: '#5BDB8A',
  danger: '#F87171',
};

/**
 * The measurements the rest of the product's modals are built from, so a Clerk
 * surface is dimensioned like a Sip one rather than merely coloured like it.
 * Taken from <MentorQuiz> and <AppTour>: a 20px card corner, 12px controls,
 * 28px card padding, a 460px card, and a 13px/14.5px/600 primary button.
 */
const SHAPE = {
  cardRadius: '20px',
  controlRadius: '12px',
  cardPadding: '28px',
  cardWidth: '460px',
};

/** Matches the quiz overlay exactly, so the two backdrops are indistinguishable. */
const BACKDROP = 'rgba(4,7,13,0.72)';

const FONT = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

/**
 * One appearance for every Clerk surface: sign in, sign up, the password and
 * verification-code steps, the user button/profile, and the modal the landing
 * quiz opens.
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
 *
 * NOTE: this object styles the /sign-in and /sign-up PAGES as well as the
 * modal. That is deliberate — one Clerk look for the whole product — but it
 * does mean a change here is visible on three surfaces, not one.
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
    colorModalBackdrop: BACKDROP,
    fontFamily: FONT,
    // 12px, matching every control in the quiz card. Clerk derives the card's
    // own corner from this too, which the `card` element rule overrides back up
    // to 20 so the two radii stay distinct the way Sip's do.
    borderRadius: SHAPE.controlRadius,
  },
  elements: {
    /*
     * Modal chrome. Without these the quiz hands off from a blurred, 20px-corner
     * card to a plain scrim and a tighter box, which is the "generic Clerk modal
     * dropped on the page" seam. The backdrop values are the quiz overlay's,
     * copied rather than approximated.
     */
    modalBackdrop: {
      backgroundColor: BACKDROP,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    },
    modalContent: {
      width: '100%',
      maxWidth: SHAPE.cardWidth,
    },
    modalCloseButton: {
      color: SIP.muted,
      '&:hover': { color: SIP.text, backgroundColor: 'transparent' },
    },

    card: {
      backgroundColor: SIP.card,
      border: `1px solid ${SIP.border}`,
      borderRadius: SHAPE.cardRadius,
      padding: SHAPE.cardPadding,
      boxShadow: 'none',
    },
    // Clerk splits the card into a body and a footer block; both need the page
    // background or the footer reads as a separate grey shelf under the card.
    cardBox: {
      borderRadius: SHAPE.cardRadius,
      border: 'none',
      boxShadow: 'none',
    },
    /*
     * `backgroundImage`, not just `backgroundColor`. Clerk's footer wash is a
     * `linear-gradient(rgba(255,255,255,0.03), …)`, so clearing the colour alone
     * left it visibly lighter than the card above it — the grey shelf under the
     * form in the screenshots this replaces.
     */
    footer: { backgroundColor: 'transparent', backgroundImage: 'none', borderTop: 'none' },
    footerAction: { backgroundColor: 'transparent', backgroundImage: 'none' },

    // Type scale lifted from the quiz card: 21/700 heading, 14/1.6 muted body.
    headerTitle: { color: SIP.text, fontSize: '21px', fontWeight: 700, letterSpacing: '-0.01em' },
    headerSubtitle: { color: SIP.muted, fontSize: '14px', lineHeight: 1.6 },
    formFieldLabel: { color: SIP.muted, fontSize: '13px', fontWeight: 500 },

    // Background and text always move together. Setting one without the other is
    // what made these fields unreadable.
    formFieldInput: {
      backgroundColor: SIP.input,
      color: SIP.text,
      border: `1px solid ${SIP.border}`,
      borderRadius: SHAPE.controlRadius,
      padding: '13px 14px',
      fontSize: '14px',
    },
    otpCodeFieldInput: {
      backgroundColor: SIP.input,
      color: SIP.text,
      border: `1px solid ${SIP.border}`,
      borderRadius: SHAPE.controlRadius,
    },
    formFieldInputShowPasswordButton: { color: SIP.muted },

    /*
     * The same button the quiz's primary control is: full width, flat accent,
     * 12px corner, 13px of padding, 14.5/600 label. Clerk's default is a
     * smaller, uppercase-tracked button with a shadow, which is the single most
     * recognisable "this is a Clerk form" tell.
     */
    formButtonPrimary: {
      backgroundColor: SIP.primary,
      color: '#FFFFFF',
      border: 'none',
      borderRadius: SHAPE.controlRadius,
      padding: '13px',
      fontSize: '14.5px',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: 'normal',
      boxShadow: 'none',
      '&:hover': { backgroundColor: SIP.primaryHover },
      '&:focus': { boxShadow: `0 0 0 2px ${SIP.primary}` },
    },
    formButtonReset: { color: SIP.muted },

    socialButtonsBlockButton: {
      backgroundColor: SIP.bg,
      border: `1px solid ${SIP.border}`,
      borderRadius: SHAPE.controlRadius,
      color: SIP.text,
      padding: '12px',
      fontSize: '14px',
      fontWeight: 600,
      '&:hover': { backgroundColor: SIP.input, borderColor: 'rgba(255,255,255,0.16)' },
    },
    socialButtonsBlockButtonText: { fontWeight: 600 },

    formFieldHintText: { color: SIP.muted, lineHeight: 1.5, marginTop: 6 },
    formFieldSuccessText: { color: SIP.success, lineHeight: 1.5, marginTop: 4 },
    formFieldWarningText: { lineHeight: 1.5, marginTop: 4 },
    formFieldErrorText: { color: SIP.danger, lineHeight: 1.5, marginTop: 4 },

    dividerLine: { backgroundColor: SIP.border },
    dividerText: { color: SIP.muted, fontSize: '12px' },
    footerActionText: { color: SIP.muted, fontSize: '13px' },
    footerActionLink: {
      color: SIP.link,
      fontWeight: 600,
      '&:hover': { color: SIP.link, textDecoration: 'underline' },
    },
    identityPreviewText: { color: SIP.text },
    identityPreviewEditButton: { color: SIP.link },
  },
};
