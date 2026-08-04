/**
 * Questions a prospective mentor has before signing up.
 *
 * This lives in its own module rather than in page.tsx because page.tsx is a
 * client component. Importing a plain value out of a `'use client'` module from
 * a server component does not give you the value — the bundler replaces it with
 * a client reference proxy, so the layout received an object with no .map and
 * the build failed while serialising the structured data. A shared module with
 * no directive is importable from both sides and stays a real array.
 *
 * Both consumers matter and must stay in sync: page.tsx renders these as
 * visible copy, and layout.tsx emits the same strings as FAQPage structured
 * data. Google requires the answers in the markup to be present on the page,
 * so one source is the only correct arrangement.
 */
export const MENTOR_FAQ: { q: string; a: string }[] = [
  {
    q: 'How much time does mentoring on Sip take?',
    a: 'As little as twenty minutes. Most sips are a single short conversation rather than an ongoing commitment, and you decide when you are open. There is no minimum, no weekly obligation, and no penalty for closing your door for a while.',
  },
  {
    q: 'Do I need to be senior to be a mentor?',
    a: 'No. The most useful mentor is usually someone two or three years ahead of the person asking, not twenty. If you have already done the thing a student is trying to do — landed the internship, switched fields, got into the programme — you know something they need.',
  },
  {
    q: 'Who will contact me, and can I decline?',
    a: 'Students and early-career people send a short request explaining what they are stuck on. You see it before you commit to anything, and you accept or decline in one click. Declining costs you nothing and is never shown publicly.',
  },
  {
    q: 'Is being a mentor on Sip free?',
    a: 'Yes. Listing yourself is free, and mentors are neither charged nor paid. Sip exists to remove the cold-outreach step, not to run a marketplace.',
  },
  {
    q: 'Do I have to share my personal contact details?',
    a: 'No. Your account email is never shown to seekers. You choose whether to share a booking link or a separate contact email, and it is only released to a seeker after you accept their request.',
  },
  {
    q: 'What do I actually talk about?',
    a: 'You pick the topics you are willing to cover when you sign up, and requests are matched against them. Most conversations are about how you got where you are, what you would do differently, and what the person asking should do next.',
  },
];
