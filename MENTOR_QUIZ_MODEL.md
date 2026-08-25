MODEL: Landing Page Mentor-Match Quiz

1. Trigger condition
Component renders on landing page only if !isSignedIn (Clerk useUser() hook). Signed-in users never see it, full stop.

2. Flow (state machine, one component, multiple internal steps)

Step 0: Intro — "Hey, I see you're here to look for a mentor. I gotchu." → Next button
Step 1: Interest — single-select from the 20 existing tags. Saves as interest.
Step 2: "Tell us about yourself" — free text or keyword chips (funny, hardworking, artistic, etc). Explicitly never saved to DB or cookie, purely for engagement/fun, discarded on submit.
Step 3: "Your dream in one line" — free text, same deal, not saved. Purely vibes.
Step 4: One or two more light quick questions, same non-saved treatment.
Step 5: Loading/transition state — "I gotchu, searching for a mentor for you" → fires the mentor lookup API call using only the interest value from Step 1.
Step 6: Mentor reveal — shows the matched mentor big (photo, name, short bio) → "Let's get you matched" button.
Step 7: Auth gate — if not signed in (already true since component only shows to signed-out users, but re-check here in case session changed mid-quiz), show "You're not signed in, let's fix that" → button to Clerk sign in/sign up, same page or modal, your call.
Post-signup: redirect to /mentors/[mentorId] using the id captured in Step 6.

Only interest ever gets written to the cookie or DB. Steps 2–4 answers live in component state only, for the duration of the quiz, and are thrown away, never touch saveQuizAnswer.

3. Cookie usage
Only saveQuizAnswer("interest", value) gets called, at Step 1. Session id created at Step 0 via getOrCreateSessionId().

4. Mentor match endpoint
GET /api/mentors/suggest?interest=tech

Public, unauthenticated
Rate limited (~10 req/min/IP)
Query: mentors table filtered by interest tag, ORDER BY RANDOM() LIMIT 1
Returns: { mentorId, name, shortBio, photoUrl } — nothing else

5. Post-signup handoff
Immediately after Clerk redirect completes (client-side, on the page the user lands on after signup), read sip_quiz_answers cookie, if interest exists, POST it to your users table attached to the new Clerk user id, then redirect to /mentors/[mentorId]?from=quiz. Cookies cleared after this fires.

6. Onboarding component changes
Existing seeker onboarding (name, LinkedIn, age, pfp checklist) stays exactly as is. No "what are you into" step added there, since that's now captured pre-signup.

7. Funnel/admin dashboard additions
Two new funnel steps between "Landing view" and "Signed up": "Quiz started" (fires at Step 1) and "Quiz completed" (fires at Step 6, mentor shown). Log these the same way existing funnel events are logged.