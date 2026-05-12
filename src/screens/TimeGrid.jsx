import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { GCAL_EVENTS } from '../data/mockData';

const G_START = 8;
const G_END = 20;
const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const TOTAL = (G_END - G_START) * SPH;
const SLOT_H = 28;
const LABEL_W = 40;
const DAYS_LBL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DATES = ['5', '6', '7', '8', '9'];

const fmtH = h => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

function initSlots() {
  const g = {};
  for (let d = 0; d < 5; d++) for (let s = 0; s < TOTAL; s++) g[`${d}-${s}`] = 2;
  GCAL_EVENTS.forEach(ev => {
    const s0 = (ev.startH - G_START) * SPH + Math.floor(ev.startM / SLOT_MIN);
    const s1 = (ev.endH - G_START) * SPH + Math.ceil(ev.endM / SLOT_MIN);
    for (let s = Math.max(0, s0); s < Math.min(TOTAL, s1); s++) g[`${ev.day}-${s}`] = 1;
  });
  return g;
}

const slotBg = { 0: 'transparent', 1: '#FFCDD2', 2: '#A5D6A7', 3: '#FFE082' };
const slotBorder = { 1: '#EF9A9A', 2: '#66BB6A', 3: '#FFD54F' };

export default function TimeGrid() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState(initSlots);
  const dragRef = useRef({ active: false, target: null, lastKey: null });
  const baseSlots = useRef(initSlots());

  const nextState = (cur, isGcal) => {
    if (isGcal) {
      if (cur === 1) return 3;
      if (cur === 3) return 2;
      if (cur === 2) return 1;
      return 3;
    } else {
      if (cur === 2) return 1;
      if (cur === 1) return 3;
      if (cur === 3) return 2;
      if (cur === 0) return 2;
      return 2;
    }
  };

  const paintModeFor = (state, day, slot) => {
    const isGcal = baseSlots.current[`${day}-${slot}`] === 1;
    return nextState(state, isGcal);
  };

  const applySlot = (key, targetState) => {
    setSlots(prev => ({ ...prev, [key]: targetState }));
  };

  const startDrag = (day, slot) => {
    const key = `${day}-${slot}`;
    const state = slots[key];
    const target = paintModeFor(state, day, slot);
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

  const handleTouchStart = (e, day, slot) => {
    const key = `${day}-${slot}`;
    const state = slots[key];
    const target = paintModeFor(state, day, slot);
    dragRef.current = { active: true, target, lastKey: key };
    applySlot(key, target);
  };

  const handleTouchMoveGrid = (e) => {
    if (!dragRef.current.active) return;
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el && el.dataset.slot !== undefined && el.dataset.day !== undefined) {
      moveDrag(+el.dataset.day, +el.dataset.slot);
    }
  };

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <StatusBar />
      <div className="app-nav">
        <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>May 5–9</span>
        <span className="nav-title">Your availability</span>
        <button className="nav-action" onClick={() => navigate('/results')}>Done</button>
      </div>

      <div style={{ padding: '6px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[
            { color: '#FFCDD2', border: '#EF9A9A', label: 'Busy' },
            { color: '#FFE082', border: '#FFD54F', label: 'If needed' },
            { color: '#A5D6A7', border: '#66BB6A', label: 'Free' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, border: `1px solid ${item.border}` }} />
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#AAA' }}>3 of 5 responded</div>
      </div>

      <div
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        onMouseUp={endDrag}
        onTouchEnd={endDrag}
        onTouchMove={handleTouchMoveGrid}
        onMouseLeave={endDrag}
      >
        <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
          {DAYS_LBL.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '5px 0 6px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: i === 3 ? '#8a9da8' : '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
              <div style={{
                width: 22, height: 22, borderRadius: 11, margin: '2px auto 0',
                background: i === 3 ? '#8a9da8' : 'transparent',
                color: i === 3 ? '#fff' : '#111',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{DATES[i]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', userSelect: 'none', WebkitUserSelect: 'none' }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            {Array.from({ length: TOTAL }, (_, s) => (
              <div key={s} style={{
                height: SLOT_H,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                paddingRight: 5, paddingTop: 2,
                borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent',
              }}>
                {s % SPH === 0 && <span style={{ fontSize: 9, fontWeight: 600, color: '#BBB' }}>{fmtH(G_START + s / SPH)}</span>}
              </div>
            ))}
          </div>

          {[0, 1, 2, 3, 4].map(day => (
            <div key={day} style={{ flex: 1, borderLeft: day > 0 ? '1px solid #EBEBEB' : 'none', position: 'relative' }}>
              {GCAL_EVENTS.filter(ev => ev.day === day).map((ev, i) => {
                const s0 = (ev.startH - G_START) * SPH + Math.floor(ev.startM / SLOT_MIN);
                const s1 = (ev.endH - G_START) * SPH + Math.ceil(ev.endM / SLOT_MIN);
                const ht = (s1 - s0) * SLOT_H;
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    top: s0 * SLOT_H + 1, left: 1, right: 1,
                    height: ht - 2,
                    zIndex: 10,
                    pointerEvents: 'none',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                    padding: '2px 3px',
                    overflow: 'hidden',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#B71C1C', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: ht >= 40 ? 'normal' : 'nowrap' }}>
                      {ev.title}
                    </span>
                  </div>
                );
              })}

              {Array.from({ length: TOTAL }, (_, slot) => {
                const key = `${day}-${slot}`;
                const state = slots[key];
                const isHourBorder = slot % SPH === 0;
                const bg = slotBg[state];
                const bd = slotBorder[state];
                return (
                  <div key={slot}
                    data-day={day} data-slot={slot}
                    onMouseDown={() => startDrag(day, slot)}
                    onMouseEnter={() => moveDrag(day, slot)}
                    onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, day, slot); }}
                    style={{
                      height: SLOT_H,
                      background: bg,
                      borderTop: isHourBorder ? '1px solid #EBEBEB' : '1px solid transparent',
                      borderBottom: bd && state > 1 ? `1px solid ${bd}` : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.08s',
                      position: 'relative',
                      zIndex: 5,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { state: 2, color: '#A5D6A7', textColor: '#2E7D32', label: 'Free' },
            { state: 3, color: '#FFE082', textColor: '#F57F17', label: 'If needed' },
            { state: 1, color: '#FFCDD2', textColor: '#C62828', label: 'Busy' },
          ].map(item => {
            const count = Object.values(slots).filter(v => v === item.state).length;
            return count > 0 ? (
              <div key={item.state} style={{ flex: 1, background: item.color, borderRadius: 8, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: item.textColor }}>{count}</div>
                <div style={{ fontSize: 10, color: item.textColor, opacity: 0.8 }}>{item.label}</div>
              </div>
            ) : null;
          })}
        </div>
        <div style={{ fontSize: 11, color: '#AAA', textAlign: 'center', marginBottom: 8 }}>Tap a slot to cycle · Drag to paint</div>
        <button className="btn-primary" onClick={() => navigate('/results')} style={{ padding: '13px' }}>
          Submit availability
        </button>
      </div>
    </div>
  );
}
