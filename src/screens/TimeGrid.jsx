import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StatusBar from '../components/StatusBar';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 28;
const LABEL_W = 40;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtH = h => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

function buildDays(rangeStartTs, rangeEndTs) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // fallback: today + next 3 days
  const fallback = () => {
    const days = [];
    let todayIdx = -1;
    for (let i = 0; i < 4; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (i === 0) todayIdx = 0;
      days.push({ label: DOW[d.getDay()], date: String(d.getDate()) });
    }
    const last = new Date(today); last.setDate(today.getDate() + 3);
    const navLabel = today.getMonth() === last.getMonth()
      ? `${MON[today.getMonth()]} ${today.getDate()}–${last.getDate()}`
      : `${MON[today.getMonth()]} ${today.getDate()} – ${MON[last.getMonth()]} ${last.getDate()}`;
    return { days, todayIdx, navLabel, count: 4 };
  };

  if (!rangeStartTs) return fallback();

  const start = new Date(rangeStartTs); start.setHours(0, 0, 0, 0);
  const end = rangeEndTs ? new Date(rangeEndTs) : new Date(start); end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const count = Math.min(4, totalDays);

  let todayIdx = -1;
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d.getTime() === today.getTime()) todayIdx = i;
    days.push({ label: DOW[d.getDay()], date: String(d.getDate()) });
  }

  const last = new Date(start); last.setDate(start.getDate() + count - 1);
  const navLabel = start.getMonth() === last.getMonth()
    ? `${MON[start.getMonth()]} ${start.getDate()}–${last.getDate()}`
    : `${MON[start.getMonth()]} ${start.getDate()} – ${MON[last.getMonth()]} ${last.getDate()}`;

  return { days, todayIdx, navLabel, count };
}

function initSlots(count, total) {
  const g = {};
  for (let d = 0; d < count; d++)
    for (let s = 0; s < total; s++)
      g[`${d}-${s}`] = 0;
  return g;
}

export default function TimeGrid() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { days, todayIdx, navLabel, count } = buildDays(state?.rangeStart, state?.rangeEnd);

  // Derive time window from home's slider (each slot = 30 min from midnight)
  const G_START = state?.allDay ? 0 : Math.floor((state?.startSlot ?? 16) / 2);
  const G_END   = state?.allDay ? 24 : Math.ceil((state?.endSlot   ?? 36) / 2);
  const TOTAL   = (G_END - G_START) * SPH;

  const [slots, setSlots] = useState(() => initSlots(count, TOTAL));
  const dragRef = useRef({ active: false, target: null, lastKey: null });

  const toggle = (cur) => (cur === 0 ? 1 : 0);

  const applySlot = (key, val) =>
    setSlots(prev => ({ ...prev, [key]: val }));

  const startDrag = (day, slot) => {
    const key = `${day}-${slot}`;
    const target = toggle(slots[key]);
    dragRef.current = { active: true, target, lastKey: key };
    applySlot(key, target);
  };

  const moveDrag = (day, slot) => {
    if (!dragRef.current.active) return;
    const key = `${day}-${slot}`;
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
          {days.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '5px 0 6px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: i === todayIdx ? '#8a9da8' : '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.label}</div>
              <div style={{ width: 22, height: 22, borderRadius: 11, margin: '2px auto 0', background: i === todayIdx ? '#8a9da8' : 'transparent', color: i === todayIdx ? '#fff' : '#111', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.date}</div>
            </div>
          ))}
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
          {Array.from({ length: count }, (_, day) => (
            <div key={day} style={{ flex: 1, borderLeft: day > 0 ? '1px solid #EBEBEB' : 'none' }}>
              {Array.from({ length: TOTAL }, (_, slot) => {
                const key = `${day}-${slot}`;
                const free = slots[key] === 1;
                return (
                  <div key={slot}
                    data-day={day} data-slot={slot}
                    onMouseDown={() => startDrag(day, slot)}
                    onMouseEnter={() => moveDrag(day, slot)}
                    onTouchStart={(e) => { e.stopPropagation(); startDrag(day, slot); }}
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
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#AAA', textAlign: 'center', marginBottom: 8 }}>Tap a slot to toggle · Drag to paint</div>
        <button className="btn-primary" onClick={() => navigate('/results')} style={{ padding: '13px' }}>
          Submit availability
        </button>
      </div>
    </div>
  );
}
