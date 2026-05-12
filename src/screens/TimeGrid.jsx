import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StatusBar from '../components/StatusBar';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 28;
const LABEL_W = 48;
const SCROLL_W = 24;
const DAYS_PER_PAGE = 4;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtH = h => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

function buildAllDays(rangeStartTs, rangeEndTs) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!rangeStartTs) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth(), ts: d.getTime() });
    }
    return { days, todayIdx: 0 };
  }
  const start = new Date(rangeStartTs); start.setHours(0, 0, 0, 0);
  const end = rangeEndTs ? new Date(rangeEndTs) : new Date(start); end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  let todayIdx = -1;
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d.getTime() === today.getTime()) todayIdx = i;
    days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth(), ts: d.getTime() });
  }
  return { days, todayIdx };
}

function pageNavLabel(pageDays) {
  if (!pageDays.length) return '';
  const first = pageDays[0];
  const last = pageDays[pageDays.length - 1];
  return first.month === last.month
    ? `${MON[first.month]} ${first.date}–${last.date}`
    : `${MON[first.month]} ${first.date} – ${MON[last.month]} ${last.date}`;
}

function initSlots(totalDays, total) {
  const g = {};
  for (let d = 0; d < totalDays; d++)
    for (let s = 0; s < total; s++)
      g[`${d}-${s}`] = 0;
  return g;
}

export default function TimeGrid() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const { days: allDays, todayIdx } = buildAllDays(state?.rangeStart, state?.rangeEnd);
  const totalDays = allDays.length;
  const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

  const G_START = state?.allDay ? 0  : Math.floor((state?.startSlot ?? 16) / 2);
  const G_END   = state?.allDay ? 24 : Math.ceil((state?.endSlot   ?? 36) / 2);
  const TOTAL   = (G_END - G_START) * SPH;

  const [page, setPage] = useState(0);
  const [slots, setSlots] = useState(() => initSlots(totalDays, TOTAL));
  const [showNameModal, setShowNameModal] = useState(false);
  const [name, setName] = useState('');

  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  const slotsRef = useRef(slots);
  useEffect(() => { slotsRef.current = slots; }, [slots]);

  const dragRef = useRef({ active: false, target: 0, lastKey: null });
  // gesture: phase = 'idle' | 'pending' | 'paint' | 'scroll' | 'swipe'
  const gestureRef = useRef({ phase: 'idle', startX: 0, startY: 0, startDay: null, startSlot: null });
  const scrollContainerRef = useRef(null);

  const applySlot = (key, val) => setSlots(prev => ({ ...prev, [key]: val }));

  const startDrag = (dayIdx, slot) => {
    const key = `${dayIdx}-${slot}`;
    const target = slotsRef.current[key] === 0 ? 1 : 0;
    dragRef.current = { active: true, target, lastKey: key };
    applySlot(key, target);
  };

  const moveDrag = (dayIdx, slot) => {
    if (!dragRef.current.active) return;
    const key = `${dayIdx}-${slot}`;
    if (key === dragRef.current.lastKey) return;
    dragRef.current.lastKey = key;
    applySlot(key, dragRef.current.target);
  };

  // Non-passive touchmove to allow preventDefault (React's synthetic events are passive)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onMove = (e) => {
      const g = gestureRef.current;
      if (g.phase === 'idle') return;
      const t = e.touches[0];

      if (g.phase === 'pending') {
        const dx = Math.abs(t.clientX - g.startX);
        const dy = Math.abs(t.clientY - g.startY);
        if (dx < 6 && dy < 6) return;
        if (dx > dy) {
          g.phase = 'swipe';
        } else if (g.startDay !== null) {
          g.phase = 'paint';
          startDrag(g.startDay, g.startSlot);
        } else {
          g.phase = 'scroll';
        }
      }

      if (g.phase === 'paint') {
        e.preventDefault();
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el?.dataset.slot !== undefined && el?.dataset.day !== undefined) {
          moveDrag(+el.dataset.day, +el.dataset.slot);
        }
      } else if (g.phase === 'swipe') {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', onMove, { passive: false });
    return () => container.removeEventListener('touchmove', onMove);
  }, []); // refs keep functions fresh; no stale closure issues

  const handleContainerTouchStart = (e) => {
    const t = e.touches[0];
    const el = e.target;
    const startDay  = el?.dataset?.day  !== undefined ? +el.dataset.day  : null;
    const startSlot = el?.dataset?.slot !== undefined ? +el.dataset.slot : null;
    gestureRef.current = { phase: 'pending', startX: t.clientX, startY: t.clientY, startDay, startSlot };
  };

  const handleContainerTouchEnd = (e) => {
    const g = gestureRef.current;
    if (g.phase === 'pending' && g.startDay !== null) {
      // Tap — toggle slot
      startDrag(g.startDay, g.startSlot);
    } else if (g.phase === 'swipe') {
      const dx = e.changedTouches[0].clientX - g.startX;
      const cur = pageRef.current;
      if (dx < -50 && cur < totalPages - 1) setPage(cur + 1);
      if (dx >  50 && cur > 0)             setPage(cur - 1);
    }
    g.phase = 'idle';
    dragRef.current.active = false;
  };

  // Mouse support (desktop)
  const handleMouseDown = (dayIdx, slot) => startDrag(dayIdx, slot);
  const handleMouseEnter = (dayIdx, slot) => moveDrag(dayIdx, slot);
  const handleMouseUp = () => { dragRef.current.active = false; };

  const pageStart = page * DAYS_PER_PAGE;
  const pageDays  = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);
  const navLabel  = pageNavLabel(pageDays);

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <StatusBar />
      <div className="app-nav">
        <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{navLabel}</span>
        <span className="nav-title">Your availability</span>
        <button className="nav-action" onClick={() => navigate('/results')}>Done</button>
      </div>

      <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: '#478058' }} />
        <span style={{ fontSize: 11, color: '#666' }}>Tap or drag to mark your available times</span>
      </div>

      {/* Scrollable grid — touchmove handled via non-passive listener */}
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleContainerTouchStart}
        onTouchEnd={handleContainerTouchEnd}
      >
        {/* Day headers */}
        <div style={{ display: 'flex', paddingLeft: LABEL_W, paddingRight: SCROLL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
          {pageDays.map((d, i) => {
            const globalIdx = pageStart + i;
            const isToday = globalIdx === todayIdx;
            return (
              <div key={globalIdx} style={{ flex: 1, textAlign: 'center', padding: '5px 0 6px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? '#8a9da8' : '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.label}</div>
                <div style={{ width: 22, height: 22, borderRadius: 11, margin: '2px auto 0', background: isToday ? '#8a9da8' : 'transparent', color: isToday ? '#fff' : '#111', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.date}</div>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', userSelect: 'none', WebkitUserSelect: 'none' }}>
          {/* Hour labels */}
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            {Array.from({ length: TOTAL }, (_, s) => (
              <div key={s} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 2, borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px dashed #F0F0F0' }}>
                {s % SPH === 0 && <span style={{ fontSize: 9, fontWeight: 600, color: '#BBB' }}>{fmtH(G_START + s / SPH)}</span>}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {pageDays.map((_, i) => {
            const globalIdx = pageStart + i;
            return (
              <div key={globalIdx} style={{ flex: 1, borderLeft: i > 0 ? '1px solid #EBEBEB' : 'none' }}>
                {Array.from({ length: TOTAL }, (_, slot) => {
                  const key = `${globalIdx}-${slot}`;
                  const free = slots[key] === 1;
                  return (
                    <div key={slot}
                      data-day={globalIdx} data-slot={slot}
                      onMouseDown={() => handleMouseDown(globalIdx, slot)}
                      onMouseEnter={() => handleMouseEnter(globalIdx, slot)}
                      style={{
                        height: SLOT_H,
                        background: free ? '#478058' : 'transparent',
                        borderTop: slot % SPH === 0 ? '1px solid #EBEBEB' : '1px dashed #F0F0F0',
                        cursor: 'pointer',
                        transition: 'background 0.08s',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Right scroll strip — no data attrs so vertical drag here scrolls */}
          <div style={{ width: SCROLL_W, flexShrink: 0 }} />
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 12 }}>
            {Array.from({ length: totalPages }, (_, i) => (
              <div key={i} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, background: i === page ? '#478058' : '#E0E0E0', transition: 'all 0.2s' }} />
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#AAA', textAlign: 'center', marginBottom: 8 }}>Tap · Drag to paint · Swipe left/right to change days</div>
        <button className="btn-primary" onClick={() => setShowNameModal(true)} style={{ padding: '13px' }}>
          Submit availability
        </button>
      </div>

      {/* Name modal */}
      {showNameModal && (
        <div
          onClick={() => setShowNameModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E0E0', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>What's your name?</div>
            <div style={{ fontSize: 13, color: '#AAA', marginBottom: 20 }}>So others know whose availability this is.</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && navigate('/results')}
              placeholder="Your name"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <button
              className="btn-primary"
              disabled={!name.trim()}
              onClick={() => name.trim() && navigate('/results')}
              style={{ padding: '13px', opacity: name.trim() ? 1 : 0.4 }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
