import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StatusBar from '../components/StatusBar';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 28;
const LABEL_W = 40;
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
  if (first.month === last.month)
    return `${MON[first.month]} ${first.date}–${last.date}`;
  return `${MON[first.month]} ${first.date} – ${MON[last.month]} ${last.date}`;
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
  const dragRef = useRef({ active: false, target: null, lastKey: null });

  const pageStart = page * DAYS_PER_PAGE;
  const pageDays = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);
  const navLabel = pageNavLabel(pageDays);

  const toggle = (cur) => (cur === 0 ? 1 : 0);

  const applySlot = (key, val) =>
    setSlots(prev => ({ ...prev, [key]: val }));

  const startDrag = (dayIdx, slot) => {
    const key = `${dayIdx}-${slot}`;
    const target = toggle(slots[key]);
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

  const endDrag = () => { dragRef.current.active = false; };

  const handleTouchMoveGrid = (e) => {
    if (!dragRef.current.active) return;
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el?.dataset.slot !== undefined && el?.dataset.day !== undefined) {
      moveDrag(+el.dataset.day, +el.dataset.slot);
    }
  };

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

      <div
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        onMouseUp={endDrag}
        onTouchEnd={endDrag}
        onTouchMove={handleTouchMoveGrid}
        onMouseLeave={endDrag}
      >
        {/* Day headers */}
        <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
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

          {/* Day columns — keyed by global day index */}
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
                      onMouseDown={() => startDrag(globalIdx, slot)}
                      onMouseEnter={() => moveDrag(globalIdx, slot)}
                      onTouchStart={(e) => { e.stopPropagation(); startDrag(globalIdx, slot); }}
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
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        {/* Page navigation */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: page === 0 ? '#F5F5F5' : '#F0F4F2', color: page === 0 ? '#CCC' : '#478058', fontSize: 15, fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>←</span> Prev
            </button>

            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {Array.from({ length: totalPages }, (_, i) => (
                <div key={i} onClick={() => setPage(i)} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, background: i === page ? '#478058' : '#E0E0E0', cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages - 1}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: page === totalPages - 1 ? '#F5F5F5' : '#478058', color: page === totalPages - 1 ? '#CCC' : '#fff', fontSize: 15, fontWeight: 700, cursor: page === totalPages - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              Next <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
          </div>
        )}

        <button className="btn-primary" onClick={() => navigate('/results')} style={{ padding: '13px' }}>
          Submit availability
        </button>
      </div>
    </div>
  );
}
