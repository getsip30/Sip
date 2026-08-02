'use client';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useRoles } from '@/hooks/useRoles';
import { ConsentGate } from '@/components/ConsentGate';
import { bookingOptions } from '@/lib/booking';

type Room = { id: string; title: string; roomUrl: string | null; status: string; mode: string; scheduledAt: string | null; firstName: string; lastName: string; role: string; company: string; mentorClerkId: string };
type ConnectStatus = 'none' | 'pending' | 'accepted';
type QueueEntry = { id: string; seekerClerkId: string; seekerName: string; topic?: string; status: string; isMine?: boolean; visitCount?: number; flagCount?: number; doneAt?: string | null; connectStatus?: ConnectStatus };

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const { loaded: rolesLoaded } = useRoles();

  useEffect(() => {
    if (userLoaded && !user) router.replace('/sign-in');
  }, [userLoaded, user, router]);
  const [room, setRoom] = useState<Room | null>(null);
  const [waiting, setWaiting] = useState<QueueEntry[]>([]);
  const [actives, setActives] = useState<QueueEntry[]>([]);
  const [recap, setRecap] = useState<QueueEntry[]>([]);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [joining, setJoining] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [calling, setCalling] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagTarget, setFlagTarget] = useState<{ id: string; name: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagDetails, setFlagDetails] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [consented, setConsented] = useState(false);
  const [modeUpdating, setModeUpdating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [sentConnects, setSentConnects] = useState<Set<string>>(new Set());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [myBooking, setMyBooking] = useState<{ calendarLink: string | null; contactEmail: string | null } | null>(null);
  const [connectChoiceFor, setConnectChoiceFor] = useState<string | null>(null);
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notedSeekers, setNotedSeekers] = useState<Record<string, number>>({});
  const [starting, setStarting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const r = await fetch(`/api/rooms/${id}`);
      if (r.ok) setRoom(await r.json());
    } catch (err) {
      console.error('fetchRoom failed:', err);
    }
  }, [id]);

  const fetchQueue = useCallback(async () => {
    try {
      const r = await fetch(`/api/rooms/${id}/queue`);
      if (!r.ok) return;
      const data = await r.json();
      setWaiting(data.waiting);
      setActives(data.active);
      setRecap(data.done || []);

      // Once a response reflects the write, the optimistic marker has done its
      // job and has to go, or a request that is later declined would leave the
      // button reading "requested" forever.
      const seen: string[] = [...data.waiting, ...data.active, ...(data.done || [])]
        .map((e: QueueEntry) => e.seekerClerkId)
        .filter(Boolean);
      if (seen.length > 0) {
        setSentConnects(prev => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          for (const cid of seen) next.delete(cid);
          return next.size === prev.size ? prev : next;
        });
      }
      if (user) {
        // Match on the server-computed `isMine` — seekers don't receive
        // seekerClerkId, so the old comparison never matched and wiped the entry
        // on every poll.
        const live = [...data.waiting, ...data.active].find((e: QueueEntry) => e.isMine);
        // Fall back to a *recently* finished entry so the "session ended" state
        // and the popup-close effect can fire; it expires so rejoining still works.
        const justDone = (data.done || []).find((e: QueueEntry) =>
          e.isMine && e.doneAt && Date.now() - new Date(e.doneAt).getTime() < 2 * 60 * 1000);
        setMyEntry(live || justDone || null);
      }
    } catch (err) {
      console.error('fetchQueue failed:', err);
    }
  }, [id, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoom();
  }, [fetchRoom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue();
    const t = setInterval(fetchQueue, 4000);
    return () => clearInterval(t);
  }, [fetchQueue]);

  // The API withholds roomUrl until the viewer's turn is active, so refetch the
  // room once that happens to pick up the join link.
  useEffect(() => {
    if (myEntry?.status === 'active' && room && !room.roomUrl) fetchRoom();
  }, [myEntry?.status, room, fetchRoom]);

  // The room host needs their own booking options to choose what to send. Only
  // fetched for the host, since nobody else can see the picker.
  useEffect(() => {
    if (!user || !room || user.id !== room.mentorClerkId) return;
    let cancelled = false;
    fetch('/api/mentor')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setMyBooking(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, room]);

  useEffect(() => {
    if (myEntry?.status === 'active' && room?.roomUrl && !popupRef.current) {
      popupRef.current = window.open(room.roomUrl, '_blank', 'noopener,noreferrer');
    }
    if (myEntry?.status === 'done' && popupRef.current) {
      popupRef.current.close();
      popupRef.current = null;
    }
  }, [myEntry, room]);

  async function joinQueue() {
    if (!user) return;
    setJoining(true);
    const seekerName = user.firstName || user.fullName || 'Someone';
    const res = await fetch(`/api/rooms/${id}/queue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seekerName, topic: topicInput.trim() || undefined }),
    });
    if (res.ok) setMyEntry({ ...(await res.json()), isMine: true });
    setJoining(false);
  }

  async function leaveQueue() {
    await fetch(`/api/rooms/${id}/queue`, { method: 'DELETE' });
    setMyEntry(null);
  }

  async function callNext(entryId: string) {
    setCalling(entryId);
    const res = await fetch(`/api/rooms/${id}/queue/${entryId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'call' }),
    });
    if (res.ok) fetchQueue();
    setCalling(null);
  }

  async function markDone(entryId: string) {
    await fetch(`/api/rooms/${id}/queue/${entryId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'done' }),
    });
    fetchQueue();
  }

  async function requestConnect(seekerClerkId: string, mode: 'review' | 'link', contactMethod?: string) {
    setConnecting(seekerClerkId);
    setConnectError(null);
    const res = await fetch(`/api/rooms/${id}/connect-request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seekerClerkId, mode, contactMethod }),
    });

    // The button used to flip back to "request 1:1" here because nothing
    // recorded the result. Mark it locally so it updates on the click rather
    // than up to a poll later, then let the next poll confirm against the
    // server. 409 means a request is already open, which is the same end state.
    if (res.ok || res.status === 409) {
      setSentConnects(prev => new Set(prev).add(seekerClerkId));
      setConnectChoiceFor(null);
    } else {
      const body = await res.json().catch(() => null);
      setConnectError(body?.error || 'Could not send that request. Try again.');
    }
    setConnecting(null);
    fetchQueue();
  }

  async function saveNote(seekerClerkId: string) {
    const text = noteDraft.trim();
    if (!text) return;
    setNoteSaving(true);
    setNoteError(null);
    const res = await fetch('/api/session-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: id, seekerClerkId, noteText: text }),
    });
    if (res.ok) {
      setNotedSeekers(prev => ({ ...prev, [seekerClerkId]: (prev[seekerClerkId] || 0) + 1 }));
      setNoteDraft('');
      setNoteOpenFor(null);
    } else {
      const body = await res.json().catch(() => null);
      setNoteError(body?.error || 'Could not save that note. Try again.');
    }
    setNoteSaving(false);
  }

  /**
   * Server truth wins: once the poll reports an open request the local optimistic
   * entry is redundant, and when a request is declined or cancelled the server
   * drops back to 'none' and the button has to become clickable again.
   */
  function connectStateFor(entry: QueueEntry): ConnectStatus {
    if (entry.connectStatus && entry.connectStatus !== 'none') return entry.connectStatus;
    return sentConnects.has(entry.seekerClerkId) ? 'pending' : 'none';
  }

  async function goLiveNow() {
    setStarting(true);
    const res = await fetch(`/api/rooms/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }),
    });
    if (res.ok) { const updated = await res.json(); setRoom(prev => prev ? { ...prev, status: updated.status } : prev); }
    setStarting(false);
  }

  async function setMode(mode: 'individual' | 'batch') {
    if (actives.length > 0) return;
    setModeUpdating(true);
    const res = await fetch(`/api/rooms/${id}/mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
    });
    if (res.ok) { const updated = await res.json(); setRoom(prev => prev ? { ...prev, mode: updated.mode } : prev); }
    setModeUpdating(false);
  }

  function toggleSelect(entryId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  }

  async function startBatch() {
    if (selected.size === 0) return;
    setBatchBusy(true);
    const res = await fetch(`/api/rooms/${id}/queue/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryIds: [...selected] }),
    });
    if (res.ok) { setSelected(new Set()); fetchQueue(); }
    setBatchBusy(false);
  }

  async function endBatch() {
    setBatchBusy(true);
    const res = await fetch(`/api/rooms/${id}/queue/batch`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }),
    });
    if (res.ok) fetchQueue();
    setBatchBusy(false);
  }

  async function submitFlag() {
    if (!flagTarget || !flagReason || !flagDetails) return;
    setFlagSubmitting(true);
    await fetch(`/api/rooms/${id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportedClerkId: flagTarget.id, reportedName: flagTarget.name, reason: flagReason, details: flagDetails }),
    });
    setFlagSubmitting(false);
    setFlagOpen(false);
    setFlagReason('');
    setFlagDetails('');
    fetchQueue();
  }

  const myPosition = myEntry?.status === 'waiting' ? waiting.findIndex(w => w.id === myEntry.id) + 1 : 0;
  const isRoomMentor = !!user && !!room && user.id === room.mentorClerkId;
  const isScheduled = room?.status === 'scheduled';
  const modeBtn = (active: boolean): React.CSSProperties => ({ background: active ? 'rgba(112,181,249,0.15)' : 'transparent', border: `1px solid ${active ? 'rgba(112,181,249,0.4)' : BORDER}`, color: active ? LINK : MUTED, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: modeUpdating || actives.length > 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });

  if (!userLoaded || !user || !room || !rolesLoaded) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>loading room...</div>
  );

  if (!consented) {
    return (
      <ConsentGate
        onAccept={() => { setConsented(true); fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: id, context: 'call' }) }); }}
        onDecline={() => { if (myEntry) leaveQueue(); window.location.href = isRoomMentor ? '/dashboard' : '/seekers'; }}
      />
    );
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Space Grotesk', sans-serif", padding: 'clamp(32px,8vw,80px) 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{room.title}</h1>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 32, wordBreak: 'break-word' }}>
            {[room.firstName, room.lastName].filter(Boolean).join(' ')}
            {room.role && room.company ? ` · ${room.role} @ ${room.company}` : ''}
          </p>

        {isScheduled ? (
          <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>{isRoomMentor ? 'this sip is scheduled' : 'not started yet'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: isRoomMentor ? 16 : 0 }}>
              {room.scheduledAt ? `starts ${new Date(room.scheduledAt).toLocaleString()}` : 'starting soon'}
            </div>
            {isRoomMentor && (
              <button onClick={goLiveNow} disabled={starting} style={{ background: ACCENT, color: 'white', border: 'none', padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: starting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {starting ? 'starting...' : 'go live now'}
              </button>
            )}
          </div>
        ) : isRoomMentor ? (
          <>
            {room.roomUrl && (
              <a href={room.roomUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: ACCENT, color: 'white', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>start call</a>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              <button onClick={() => setMode('individual')} disabled={modeUpdating || actives.length > 0} style={modeBtn(room.mode === 'individual')}>individuals</button>
              <button onClick={() => setMode('batch')} disabled={modeUpdating || actives.length > 0} style={modeBtn(room.mode === 'batch')}>batches</button>
            </div>

            {room.mode === 'batch' ? (
              <>
                {actives.length > 0 ? (
                  <div style={{ background: 'rgba(91,219,138,0.08)', border: '1px solid rgba(91,219,138,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: '#5BDB8A', fontWeight: 600, marginBottom: 10 }}>batch in progress ({actives.length})</div>
                    {actives.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600 }}>
                        {a.seekerName}
                        <button onClick={() => { setFlagTarget({ id: a.seekerClerkId, name: a.seekerName }); setFlagOpen(true); }} style={{ marginLeft: 4, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>flag</button>
                      </div>
                    ))}
                    <button onClick={endBatch} disabled={batchBusy} style={{ marginTop: 10, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#F87171', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: batchBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>end batch</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    <button onClick={startBatch} disabled={batchBusy || selected.size === 0} style={{ background: selected.size === 0 ? 'rgba(112,181,249,0.08)' : 'rgba(112,181,249,0.15)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: batchBusy || selected.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>start batch ({selected.size})</button>
                  </div>
                )}

                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Queue ({waiting.length})</h2>
                {waiting.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 14 }}>no one waiting yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {waiting.map((w, i) => (
                      <label key={w.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: actives.length > 0 ? 'default' : 'pointer', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {actives.length === 0 && (
                            <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSelect(w.id)} style={{ marginRight: 4 }} />
                          )}
                          <span style={{ color: MUTED, fontSize: 12, marginRight: 4 }}>#{i + 1}</span>
                          <span style={{ fontWeight: 600 }}>{w.seekerName}</span>
                          {!!w.visitCount && w.visitCount > 1 && (
                            <span style={{ fontSize: 11, color: LINK, background: 'rgba(112,181,249,0.1)', padding: '2px 8px', borderRadius: 8 }}>visit #{w.visitCount}</span>
                          )}
                          {!!w.flagCount && (
                            <span style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 8 }}>flagged - {w.flagCount}</span>
                          )}
                          {w.topic && (
                            <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>&quot;{w.topic}&quot;</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {recap.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recap ({recap.length})</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recap.map(r => (
                        <div key={r.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                          <span style={{ fontWeight: 600 }}>{r.seekerName}</span>
                          {r.topic && (
                            <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginLeft: 8 }}>&quot;{r.topic}&quot;</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {actives[0] && (
                  <div style={{ background: 'rgba(91,219,138,0.08)', border: '1px solid rgba(91,219,138,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: '#5BDB8A', fontWeight: 600, marginBottom: 4 }}>currently active</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{actives[0].seekerName}</span>
                      {!!actives[0].visitCount && actives[0].visitCount > 1 && (
                        <span style={{ fontSize: 11, color: LINK, background: 'rgba(112,181,249,0.1)', padding: '2px 8px', borderRadius: 8 }}>visit #{actives[0].visitCount}</span>
                      )}
                      {!!actives[0].flagCount && (
                        <span style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 8 }}>flagged - {actives[0].flagCount}</span>
                      )}
                    </div>
                    {actives[0].topic && (
                      <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginTop: 4 }}>&quot;{actives[0].topic}&quot;</div>
                    )}
                    <button onClick={() => markDone(actives[0].id)} style={{ marginTop: 10, marginRight: 8, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#F87171', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>mark done</button>
                    {(() => {
                      const state = connectStateFor(actives[0]);
                      const busy = connecting === actives[0].seekerClerkId;
                      const settled = state !== 'none';
                      const label = busy ? 'sending...' : state === 'accepted' ? '1:1 accepted ✓' : state === 'pending' ? 'requested ✓' : 'request 1:1';
                      const choiceOpen = connectChoiceFor === actives[0].seekerClerkId;
                      return (
                        <button
                          onClick={() => setConnectChoiceFor(choiceOpen ? null : actives[0].seekerClerkId)}
                          disabled={busy || settled}
                          aria-expanded={choiceOpen}
                          title={state === 'pending' ? 'Waiting on them to accept. Track it on your dashboard.' : undefined}
                          style={{ marginTop: 10, marginRight: 8, background: settled ? 'rgba(139,148,158,0.1)' : 'rgba(91,219,138,0.1)', border: `1px solid ${settled ? 'rgba(139,148,158,0.25)' : 'rgba(91,219,138,0.3)'}`, color: settled ? MUTED : '#5BDB8A', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: busy || settled ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                          {label}
                        </button>
                      );
                    })()}
                    {(() => {
                      const cid = actives[0].seekerClerkId;
                      const count = notedSeekers[cid] || 0;
                      const open = noteOpenFor === cid;
                      return (
                        <button
                          onClick={() => { setNoteOpenFor(open ? null : cid); setNoteDraft(''); setNoteError(null); }}
                          aria-expanded={open}
                          style={{ marginTop: 10, marginRight: 8, background: open ? 'rgba(112,181,249,0.18)' : 'rgba(112,181,249,0.1)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {open ? 'close notes' : count > 0 ? `notes (${count})` : 'notes'}
                        </button>
                      );
                    })()}
                    <button onClick={() => { setFlagTarget({ id: actives[0].seekerClerkId, name: actives[0].seekerName }); setFlagOpen(true); }} style={{ marginTop: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>flag & remove</button>
                    {connectError && (
                      <div role="alert" style={{ marginTop: 10, color: '#F87171', fontSize: 12 }}>{connectError}</div>
                    )}

                    {connectChoiceFor === actives[0].seekerClerkId && (() => {
                      const options = myBooking ? bookingOptions(myBooking) : [];
                      const cid = actives[0].seekerClerkId;
                      const busy = connecting === cid;
                      return (
                        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>How do you want to do this?</div>
                          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                            {actives[0].seekerName} gets an email either way.
                          </div>

                          {options.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                              {options.map(o => (
                                <button key={o.method} onClick={() => requestConnect(cid, 'link', o.method)} disabled={busy}
                                  style={{ textAlign: 'left', background: 'rgba(91,219,138,0.1)', border: '1px solid rgba(91,219,138,0.3)', color: '#5BDB8A', padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                  Send my {o.label.toLowerCase()} now
                                  <span style={{ display: 'block', color: MUTED, fontWeight: 400, fontSize: 11, marginTop: 3, wordBreak: 'break-all' }}>
                                    {o.value} · they book straight away, no approval step
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                              Add a calendar link or contact email to your profile to send it here directly.
                            </div>
                          )}

                          <button onClick={() => requestConnect(cid, 'review')} disabled={busy}
                            style={{ textAlign: 'left', width: '100%', background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            I&apos;ll review and accept manually
                            <span style={{ display: 'block', color: MUTED, fontWeight: 400, fontSize: 11, marginTop: 3 }}>
                              Lands in your dashboard to approve later
                            </span>
                          </button>

                          <button onClick={() => setConnectChoiceFor(null)}
                            style={{ marginTop: 10, background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                            cancel
                          </button>
                        </div>
                      );
                    })()}

                    {noteOpenFor === actives[0].seekerClerkId && (
                      <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                        <label htmlFor="session-note" style={{ display: 'block', fontSize: 12, color: MUTED, marginBottom: 6 }}>
                          Private note about {actives[0].seekerName}. Only you ever see this.
                        </label>
                        <textarea
                          id="session-note"
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          rows={3}
                          maxLength={2000}
                          placeholder="what they're working on, what to follow up on..."
                          style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', color: TEXT, borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                        {noteError && <div role="alert" style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>{noteError}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                          <button onClick={() => saveNote(actives[0].seekerClerkId)} disabled={noteSaving || !noteDraft.trim()}
                            style={{ background: ACCENT, border: 'none', color: 'white', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: noteSaving || !noteDraft.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: noteSaving || !noteDraft.trim() ? 0.6 : 1 }}>
                            {noteSaving ? 'saving...' : 'save note'}
                          </button>
                          <span style={{ color: MUTED, fontSize: 11 }}>{noteDraft.length}/2000</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Queue ({waiting.length})</h2>
                {waiting.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 14 }}>no one waiting yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {waiting.map((w, i) => (
                      <div key={w.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: MUTED, fontSize: 12, marginRight: 4 }}>#{i + 1}</span>
                          <span style={{ fontWeight: 600 }}>{w.seekerName}</span>
                          {!!w.visitCount && w.visitCount > 1 && (
                            <span style={{ fontSize: 11, color: LINK, background: 'rgba(112,181,249,0.1)', padding: '2px 8px', borderRadius: 8 }}>visit #{w.visitCount}</span>
                          )}
                          {!!w.flagCount && (
                            <span style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 8 }}>flagged - {w.flagCount}</span>
                          )}
                          {w.topic && (
                            <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>&quot;{w.topic}&quot;</span>
                          )}
                        </div>
                        {i === 0 && !actives[0] && (
                          <button onClick={() => callNext(w.id)} disabled={calling === w.id} style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '9px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: calling === w.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
                            {calling === w.id ? 'calling...' : 'call next ?'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {recap.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recap ({recap.length})</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recap.map(r => (
                        <div key={r.id} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                          <span style={{ fontWeight: 600 }}>{r.seekerName}</span>
                          {r.topic && (
                            <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginLeft: 8 }}>&quot;{r.topic}&quot;</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {!myEntry ? (
              <>
                <input value={topicInput} onChange={e => setTopicInput(e.target.value)} placeholder="what do you want to ask about? (optional)" maxLength={140} style={{ width: '100%', maxWidth: 320, background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', color: TEXT, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontFamily: 'inherit', fontSize: 14 }} />
                <button onClick={joinQueue} disabled={joining} style={{ background: ACCENT, color: 'white', border: 'none', padding: '13px 28px', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: joining ? 'not-allowed' : 'pointer', fontFamily: 'inherit', width: '100%', maxWidth: 320, minHeight: 48 }}>
                  {joining ? 'joining...' : 'join queue'}
                </button>
              </>
            ) : myEntry.status === 'active' ? (
              <div>
                <p style={{ color: '#5BDB8A', fontWeight: 600, marginBottom: 10 }}>you&apos;re up -- check the new tab that opened.</p>
                {room.roomUrl && (
                  <a href={room.roomUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: ACCENT, color: 'white', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>tab didn&apos;t open? click here to join</a>
                )}
              </div>
            ) : myEntry.status === 'done' ? (
              <p style={{ color: MUTED, fontWeight: 600 }}>session ended. thanks for joining.</p>
            ) : (
              <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 28px' }}>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>your position</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: LINK, marginBottom: 16 }}>#{myPosition}</div>
                <button onClick={leaveQueue} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#F87171', padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>leave queue</button>
              </div>
            )}
          </>
        )}
      </div>

      {flagOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reportDialogTitle" style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 id="reportDialogTitle" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Report {flagTarget?.name}</h3>
            <select value={flagReason} onChange={e => setFlagReason(e.target.value)} style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', color: TEXT, borderRadius: 10, padding: 10, marginBottom: 10, fontFamily: 'inherit' }}>
              <option value="">select reason</option>
              <option value="harassment">Harassment / abuse</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="noshow">No-show / wasted time</option>
              <option value="other">Other</option>
            </select>
            <textarea value={flagDetails} onChange={e => setFlagDetails(e.target.value)} placeholder="what happened?" rows={4} style={{ width: '100%', background: BG, border: '1px solid rgba(255,255,255,0.1)', color: TEXT, borderRadius: 10, padding: 10, marginBottom: 14, fontFamily: 'inherit', resize: 'none' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setFlagOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: MUTED, padding: '9px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>
              <button onClick={submitFlag} disabled={flagSubmitting || !flagReason || !flagDetails} style={{ background: '#DC2626', border: 'none', color: 'white', padding: '9px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: flagSubmitting ? 0.6 : 1 }}>submit report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

