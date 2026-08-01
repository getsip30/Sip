import { db } from '@/db';
import { mentors, seekers, rooms, requests, sipNotes, asks } from '@/db/schema';

const topics = ['tech', 'AI/ML', 'product', 'startups', 'design', 'VC', 'finance', 'research'];

async function seed() {
  const mentorData = [
    { firstName: 'Priya', lastName: 'Sharma', role: 'Software Engineer', company: 'Shopify', topics: 'tech, AI/ML, product', bio: 'Backend engineer on checkout infra. Ask me about breaking into big tech or system design interviews.', isOpen: true, availability: 'now' },
    { firstName: 'Marcus', lastName: 'Chen', role: 'Product Manager', company: 'Wealthsimple', topics: 'product, startups, finance', bio: 'PM in fintech, ex-founder. Ask about switching from eng to product.', isOpen: true, availability: 'next 30 min' },
    { firstName: 'Aisha', lastName: 'Bello', role: 'Associate', company: 'OMERS Ventures', topics: 'VC, startups, finance', bio: 'Seed-stage VC associate. Happy to talk pitching, cap tables, breaking into venture.', isOpen: true, availability: 'now' },
    { firstName: 'Daniel', lastName: 'Osei', role: 'ML Research Engineer', company: 'Cohere', topics: 'AI/ML, research, tech', bio: 'Working on LLM training infra. Good for grad school or ML research path questions.', isOpen: false, availability: 'later today' },
    { firstName: 'Sofia', lastName: 'Reyes', role: 'UX Designer', company: 'Wattpad', topics: 'design, product, tech', bio: 'Self-taught product designer, no design degree. Portfolio reviews welcome.', isOpen: true, availability: 'now' },
    { firstName: 'Ben', lastName: 'Thompson', role: 'Data Scientist', company: 'RBC', topics: 'AI/ML, finance, research', bio: 'Data science in banking, fraud detection models. Stats/ML fundamentals questions welcome.', isOpen: true, availability: 'next hour' },
    { firstName: 'Layla', lastName: 'Haddad', role: 'Founder', company: 'Fixt (YC S24)', topics: 'startups, product, tech', bio: 'Second-time founder, currently building in logistics. Ask about fundraising or early hiring.', isOpen: true, availability: 'now' },
    { firstName: 'Tyler', lastName: 'Nguyen', role: 'Software Engineer', company: 'Wealthsimple', topics: 'tech, AI/ML', bio: 'Full stack, ex-Meta intern. Can talk internship recruiting or interview prep.', isOpen: true, availability: 'now' },
    { firstName: 'Grace', lastName: 'Kim', role: 'Investment Banking Analyst', company: 'RBC Capital Markets', topics: 'finance, VC', bio: 'First-year analyst. Happy to demystify recruiting for IB/finance roles.', isOpen: false, availability: 'tomorrow' },
    { firstName: 'Omar', lastName: 'Farouk', role: 'Research Scientist', company: 'Vector Institute', topics: 'AI/ML, research', bio: 'PhD candidate working on RL. Can talk grad school applications or research internships.', isOpen: true, availability: 'now' },
    { firstName: 'Chloe', lastName: 'Martin', role: 'Product Designer', company: 'Shopify', topics: 'design, product', bio: 'Design systems and UX. Ask about portfolio building or design interviews.', isOpen: true, availability: 'next 30 min' },
    { firstName: 'Jordan', lastName: 'Lee', role: 'Founder', company: 'Verto Labs', topics: 'startups, tech, product', bio: 'Building dev tools solo. Can talk technical co-founding or shipping fast.', isOpen: true, availability: 'now' },
    { firstName: 'Fatima', lastName: 'Rahman', role: 'Data Engineer', company: 'TD Bank', topics: 'tech, AI/ML, finance', bio: 'Pipelines and data infra in banking. Happy to talk data eng vs data science paths.', isOpen: false, availability: 'later today' },
    { firstName: 'Ethan', lastName: 'Brooks', role: 'VC Analyst', company: 'Golden Ventures', topics: 'VC, startups', bio: 'Early-stage investing. Good for questions on how VCs actually evaluate student founders.', isOpen: true, availability: 'now' },
    { firstName: 'Nina', lastName: 'Petrova', role: 'Software Engineer', company: 'Cohere', topics: 'tech, AI/ML, research', bio: 'Infra engineer for model serving. Can talk breaking into AI companies without a PhD.', isOpen: true, availability: 'now' },
    { firstName: 'Aiden', lastName: 'Walsh', role: 'Product Manager', company: 'Loblaw Digital', topics: 'product, tech', bio: 'PM on e-commerce. Can talk PM interviews or transitioning from a non-CS degree.', isOpen: true, availability: 'next hour' },
    { firstName: 'Zara', lastName: 'Ahmed', role: 'Founder', company: 'Civiq (bootstrapped)', topics: 'startups, product, tech', bio: 'Built and shipped a civic tech platform solo as a student. Ask me anything about that.', isOpen: true, availability: 'now' },
    { firstName: 'Liam', lastName: 'O\'Connor', role: 'Quant Analyst', company: 'Ontario Teachers\' Pension Plan', topics: 'finance, research', bio: 'Quant research on fixed income. Good for math/stats-heavy finance career questions.', isOpen: false, availability: 'tomorrow' },
    { firstName: 'Maya', lastName: 'Singh', role: 'UX Researcher', company: 'Wattpad', topics: 'design, research, product', bio: 'User research for a consumer app with millions of users. Can talk research methods or breaking into UXR.', isOpen: true, availability: 'now' },
    { firstName: 'Noah', lastName: 'Bergeron', role: 'Software Engineer', company: 'Google', topics: 'tech, AI/ML', bio: 'SWE on search infra. Happy to talk new grad recruiting or coding interview prep.', isOpen: true, availability: 'now' },
  ];

  const insertedMentors = await db.insert(mentors).values(
    mentorData.map((m, i) => ({
      clerkId: `seed_mentor_${i + 1}`,
      email: `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      calendarLink: 'https://cal.com/example',
      linkedin: `linkedin.com/in/${m.firstName.toLowerCase()}${m.lastName.toLowerCase().replace(/[^a-z]/g, '')}`,
      showLinkedin: i % 3 !== 0,
      xp: Math.floor(Math.random() * 500),
      sipCount: Math.floor(Math.random() * 20),
      badges: '',
      ...m,
    }))
  ).returning();

  const seekerData = [
    { firstName: 'Ava', lastName: 'Thompson', interests: 'tech, AI/ML' },
    { firstName: 'Ryan', lastName: 'Patel', interests: 'startups, product' },
    { firstName: 'Isabella', lastName: 'Costa', interests: 'design, product' },
    { firstName: 'Kevin', lastName: 'Zhao', interests: 'finance, VC' },
    { firstName: 'Sara', lastName: 'Ibrahim', interests: 'AI/ML, research' },
    { firstName: 'Jacob', lastName: 'Muller', interests: 'tech, startups' },
    { firstName: 'Emma', lastName: 'Wilson', interests: 'product, design' },
    { firstName: 'Adam', lastName: 'Khan', interests: 'finance, tech' },
    { firstName: 'Olivia', lastName: 'Fraser', interests: 'VC, startups' },
    { firstName: 'Mason', lastName: 'Choi', interests: 'AI/ML, tech' },
  ];

  const insertedSeekers = await db.insert(seekers).values(
    seekerData.map((s, i) => ({
      clerkId: `seed_seeker_${i + 1}`,
      email: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@example.com`,
      age: 15 + Math.floor(Math.random() * 4),
      currentStreak: Math.floor(Math.random() * 10),
      longestStreak: Math.floor(Math.random() * 20),
      ...s,
    }))
  ).returning();

  // requests: a mix of pending / accepted / declined
  await db.insert(requests).values([
    { mentorId: insertedMentors[0].id, seekerClerkId: insertedSeekers[0].clerkId, seekerName: 'Ava Thompson', seekerEmail: 'ava.thompson@example.com', message: 'Would love to hear how you broke into Shopify as a new grad.', status: 'pending' },
    { mentorId: insertedMentors[1].id, seekerClerkId: insertedSeekers[1].clerkId, seekerName: 'Ryan Patel', seekerEmail: 'ryan.patel@example.com', message: 'Trying to figure out if I should aim for PM or stay technical. Would love your take.', status: 'accepted', mentorConsentToShow: true, respondedAt: new Date() },
    { mentorId: insertedMentors[2].id, seekerClerkId: insertedSeekers[2].clerkId, seekerName: 'Isabella Costa', seekerEmail: 'isabella.costa@example.com', message: 'What do VCs actually look for in a student-founded startup?', status: 'declined', respondedAt: new Date() },
    { mentorId: insertedMentors[4].id, seekerClerkId: insertedSeekers[3].clerkId, seekerName: 'Kevin Zhao', seekerEmail: 'kevin.zhao@example.com', message: 'How did you build a portfolio with no formal design background?', status: 'pending' },
    { mentorId: insertedMentors[9].id, seekerClerkId: insertedSeekers[4].clerkId, seekerName: 'Sara Ibrahim', seekerEmail: 'sara.ibrahim@example.com', message: 'Applying to grad school for ML this year, would love advice on the application.', status: 'accepted', mentorConsentToShow: false, respondedAt: new Date() },
  ]);

  // sip notes (shown live on mentor profile)
  await db.insert(sipNotes).values([
    { mentorId: insertedMentors[0].id, seekerName: 'Jacob Muller', note: 'Super helpful breakdown of how Shopify\'s interview loop actually works. Calmed me down a lot.', status: 'approved' },
    { mentorId: insertedMentors[6].id, seekerName: 'Emma Wilson', note: 'Gave me a completely different way to think about fundraising timing. 10/10.', status: 'approved' },
    { mentorId: insertedMentors[16].id, seekerName: 'Adam Khan', note: 'Hearing how Civiq actually got built made this feel way more possible for me.', status: 'approved' },
  ]);

  // asks (quick async Q&A)
  await db.insert(asks).values([
    { mentorId: insertedMentors[0].id, seekerClerkId: insertedSeekers[5].clerkId, seekerName: 'Jacob Muller', seekerEmail: 'jacob.muller@example.com', question: 'Do you need LeetCode grind or is it more system design at Shopify?', status: 'pending' },
    { mentorId: insertedMentors[9].id, seekerClerkId: insertedSeekers[6].clerkId, seekerName: 'Emma Wilson', seekerEmail: 'emma.wilson@example.com', question: 'Is a master\'s worth it before applying to research roles?', answer: 'Depends on the lab, but for RL specifically most roles want at least a master\'s. Happy to go deeper on a call.', status: 'answered', answeredAt: new Date() },
    { mentorId: insertedMentors[14].id, seekerClerkId: insertedSeekers[7].clerkId, seekerName: 'Adam Khan', seekerEmail: 'adam.khan@example.com', question: 'How much does GPA actually matter for AI new grad roles?', status: 'pending' },
  ]);

  // one live room for the "Live Now" section
  await db.insert(rooms).values([
    { mentorId: insertedMentors[0].id, title: `${insertedMentors[0].firstName}'s Sip Room`, roomName: `sip-room-${insertedMentors[0].id.slice(0, 8)}`, roomUrl: `https://meet.jit.si/sip-room-${insertedMentors[0].id.slice(0, 8)}`, status: 'live' },
  ]);

  console.log(`seeded ${insertedMentors.length} mentors, ${insertedSeekers.length} seekers, 5 requests, 3 notes, 3 asks, 1 live room`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });