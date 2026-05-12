import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { IcChevron } from '../components/Icons';

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const SLIDER_TOTAL = 48;
const slotToMins = (slot) => slot * 30;
const fmtSlot = (slot) => {
  const m = slotToMins(slot);
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(min).padStart(2, '0')}`;
};
const fmtPeriod = (slot) => {
  const m = slotToMins(slot);
  return (m < 12 * 60 || m >= 24 * 60) ? 'AM' : 'PM';
};
const TICK_LABELS = ['0','4','8','12','16','20','24'];
const DURATION_TOTAL = 47;
const dSlotToMins = (slot) => 30 + slot * 30;
const dMinsToSlot = (mins) => Math.round(Math.max(0, Math.min(DURATION_TOTAL, (mins - 30) / 30)));
const DURATION_TICKS = [
  { label: '2h',  slot: 3 },
  { label: '4h',  slot: 7 },
  { label: '8h',  slot: 15 },
  { label: '12h', slot: 23 },
  { label: '24h', slot: 47 },
];

function formatDate(date) {
  if (!date) return '';
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
function fmtDuration(d) {
  const n = Number(d);
  if (n < 60) return `${n} min`;
  if (n % 60 === 0) return `${n / 60} hr`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}
function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Duration Slider ────────────────────────────────────────────────────────────
function DurationSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const slot = dMinsToSlot(value);
  const pct = (slot / DURATION_TOTAL) * 100;
  const getSlot = (e) => {
    const track = trackRef.current;
    if (!track) return slot;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.round(Math.max(0, Math.min(DURATION_TOTAL, ((clientX - rect.left) / rect.width) * DURATION_TOTAL)));
  };
  const startDrag = (e) => {
    e.preventDefault();
    const move = (ev) => onChange(dSlotToMins(getSlot(ev)));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    move(e);
  };
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 16px 14px', border: '1.5px solid #F0F0F0' }}>
      <div style={{ background: '#e8eef1', borderRadius: 8, padding: '12px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#8a9da8', letterSpacing: '-0.02em' }}>{fmtDuration(value)}</div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px' }}>
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, top: 0, bottom: 0, background: '#8a9da8', borderRadius: 3 }} />
        <div onMouseDown={startDrag} onTouchStart={startDrag} style={{ position: 'absolute', left: `calc(${pct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8a9da8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        {DURATION_TICKS.map(({ label, slot: s }, i) => {
          const p = (s / DURATION_TOTAL) * 100;
          const transform = i === 0 ? 'none' : i === DURATION_TICKS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)';
          return <span key={label} style={{ position: 'absolute', left: `${p}%`, transform, fontSize: 10, color: '#CCC', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>;
        })}
      </div>
    </div>
  );
}

// ── Time Range Slider ──────────────────────────────────────────────────────────
function TimeRangeSlider({ startSlot, endSlot, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(null);
  const slotToPct = (s) => (s / SLIDER_TOTAL) * 100;
  const pctToSlot = (pct) => Math.round(Math.max(0, Math.min(SLIDER_TOTAL, (pct / 100) * SLIDER_TOTAL)));
  const getSlot = (e) => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return pctToSlot(((clientX - rect.left) / rect.width) * 100);
  };
  const startDrag = (handle) => (e) => {
    e.preventDefault();
    dragging.current = handle;
    const move = (e) => {
      const s = getSlot(e);
      if (s === null) return;
      if (dragging.current === 'start') onChange(Math.min(s, endSlot - 1), endSlot);
      else onChange(startSlot, Math.max(s, startSlot + 1));
    };
    const up = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };
  const sPct = slotToPct(startSlot);
  const ePct = slotToPct(endSlot);
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 16px 14px', border: '1.5px solid #F0F0F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#e8eef1', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8a9da8', letterSpacing: '-0.02em' }}>{fmtSlot(startSlot)} <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtPeriod(startSlot)}</span></div>
        </div>
        <div style={{ color: '#CCC', fontSize: 20 }}>→</div>
        <div style={{ flex: 1, background: '#e8eef1', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8a9da8', letterSpacing: '-0.02em' }}>{fmtSlot(endSlot)} <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtPeriod(endSlot)}</span></div>
        </div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px' }}>
        <div style={{ position: 'absolute', left: `${sPct}%`, width: `${ePct - sPct}%`, top: 0, bottom: 0, background: '#8a9da8', borderRadius: 3 }} />
        <div onMouseDown={startDrag('start')} onTouchStart={startDrag('start')} style={{ position: 'absolute', left: `calc(${sPct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8a9da8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
        <div onMouseDown={startDrag('end')} onTouchStart={startDrag('end')} style={{ position: 'absolute', left: `calc(${ePct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8a9da8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#CCC', fontWeight: 500, paddingLeft: 2, paddingRight: 2 }}>
        {TICK_LABELS.map(t => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

// ── Date Range Picker ──────────────────────────────────────────────────────────
function RangePicker({ startDate, endDate, onChange }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(startDate ? startDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(startDate ? startDate.getMonth() : today.getMonth());
  const isDown = useRef(false);
  const anchorRef = useRef(null);
  const liveRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const [dragAnchor, setDragAnchor] = useState(null);
  const [dragLive, setDragLive] = useState(null);
  useEffect(() => {
    const commit = () => {
      if (!isDown.current) return;
      isDown.current = false;
      const anchor = anchorRef.current;
      const live = liveRef.current || anchor;
      anchorRef.current = null; liveRef.current = null;
      setDragAnchor(null); setDragLive(null);
      if (!anchor || !live) return;
      const [s, e] = anchor <= live ? [anchor, live] : [live, anchor];
      onChangeRef.current(s, e);
    };
    window.addEventListener('mouseup', commit);
    window.addEventListener('touchend', commit);
    return () => { window.removeEventListener('mouseup', commit); window.removeEventListener('touchend', commit); };
  }, []);
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const dateFromCell = (d) => new Date(viewYear, viewMonth, d);
  const handleMouseDown = (d) => {
    const dt = dateFromCell(d);
    if (dt < today) return;
    isDown.current = true; anchorRef.current = dt; liveRef.current = dt;
    setDragAnchor(dt); setDragLive(dt);
  };
  const handleMouseEnter = (d) => {
    if (!isDown.current) return;
    const dt = dateFromCell(d);
    if (dt < today) return;
    liveRef.current = dt; setDragLive(dt);
  };
  const handleTouchMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el?.closest?.('[data-day]');
    if (!cell) return;
    const d = parseInt(cell.getAttribute('data-day'));
    if (!d) return;
    const dt = dateFromCell(d);
    if (dt < today) return;
    liveRef.current = dt; setDragLive(dt);
  };
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isDragging = dragAnchor !== null;
  const effStart = isDragging ? (dragAnchor <= (dragLive || dragAnchor) ? dragAnchor : (dragLive || dragAnchor)) : startDate;
  const effEnd = isDragging ? (dragAnchor <= (dragLive || dragAnchor) ? (dragLive || dragAnchor) : dragAnchor) : endDate;
  const phase = isDragging ? 'dragging' : !startDate ? 'empty' : 'done';
  const phaseLabel = isDragging
    ? (effStart && effEnd && !sameDay(effStart, effEnd) ? `${SHORT_MONTHS[effStart.getMonth()]} ${effStart.getDate()} – ${SHORT_MONTHS[effEnd.getMonth()]} ${effEnd.getDate()}` : `${SHORT_MONTHS[effStart.getMonth()]} ${effStart.getDate()}`)
    : phase === 'empty' ? 'Click and drag to select dates'
    : (startDate && endDate && !sameDay(startDate, endDate))
      ? `${SHORT_MONTHS[startDate.getMonth()]} ${startDate.getDate()} – ${SHORT_MONTHS[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`
      : startDate ? `${SHORT_MONTHS[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}` : 'Click and drag to select dates';
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '10px 16px 8px', background: '#F8FFFE', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: phase === 'done' || phase === 'dragging' ? '#8a9da8' : '#FFB300', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: phase === 'done' || phase === 'dragging' ? '#6b8592' : '#F57F17' }}>{phaseLabel}</span>
        {phase === 'done' && <button onClick={() => onChange(null, null)} style={{ marginLeft: 'auto', fontSize: 11, color: '#BBB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Reset</button>}
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8a9da8' }}><IcChevron dir="left" size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8a9da8' }}><IcChevron dir="right" size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
          {DAY_LABELS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#BBB', padding: '3px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', userSelect: 'none' }} onTouchMove={handleTouchMove}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dt = dateFromCell(d);
            const disabled = dt < today;
            const isStart = sameDay(dt, effStart);
            const isEnd = sameDay(dt, effEnd);
            const inRange = effStart && effEnd && dt > effStart && dt < effEnd;
            const isToday = sameDay(dt, today);
            const isSingleDay = isStart && effEnd && sameDay(effStart, effEnd);
            return (
              <div key={d} data-day={d} onMouseDown={() => handleMouseDown(d)} onMouseEnter={() => handleMouseEnter(d)} onTouchStart={() => handleMouseDown(d)} style={{ position: 'relative', height: 36, cursor: disabled ? 'default' : 'pointer' }}>
                {inRange && <div style={{ position: 'absolute', inset: 0, background: '#e8eef1' }} />}
                {isStart && effEnd && !isSingleDay && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', background: '#e8eef1' }} />}
                {isEnd && effStart && !sameDay(effStart, effEnd) && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: '#e8eef1' }} />}
                <div style={{ position: 'relative', zIndex: 1, width: 32, height: 32, borderRadius: 16, margin: '2px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isStart || isEnd ? '#8a9da8' : 'transparent', border: isToday && !isStart && !isEnd ? '1.5px solid #8a9da8' : 'none', fontSize: 13, fontWeight: isStart || isEnd || inRange ? 600 : 400, color: isStart || isEnd ? '#fff' : disabled ? '#DDD' : isToday ? '#8a9da8' : inRange ? '#6b8592' : '#111' }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Deadline Date Picker Sheet ─────────────────────────────────────────────────
function DatePickerSheet({ selected, onSelect, onClose }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isSelected = (d) => selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>Survey Deadline</div>
          {selected && <div style={{ fontSize: 13, fontWeight: 600, color: '#8a9da8' }}>{formatDate(selected)}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8a9da8' }}><IcChevron dir="left" size={18} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8a9da8' }}><IcChevron dir="right" size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
          {DAY_LABELS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#BBB', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px 0', marginBottom: 8 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const sel = isSelected(d);
            const todayMark = isToday(d);
            return (
              <div key={d} onClick={() => { onSelect(new Date(viewYear, viewMonth, d)); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? '#8a9da8' : 'transparent', border: todayMark && !sel ? '1.5px solid #8a9da8' : 'none', fontSize: 14, fontWeight: sel || todayMark ? 700 : 400, color: sel ? '#fff' : todayMark ? '#8a9da8' : '#111' }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const [showDeadlineSheet, setShowDeadlineSheet] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [startSlot, setStartSlot] = useState(18);
  const [endSlot, setEndSlot] = useState(36);
  const [allDay, setAllDay] = useState(false);
  const [duration, setDuration] = useState(60);

  return (
    <div className="app-container" style={{ background: '#fff' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#6d7b86', letterSpacing: '-0.04em' }}>meetime</span>
      </div>

      {/* Single scrollable form */}
      <div className="screen-content">
        <div style={{ padding: '16px 16px 0' }}>

          <div className="form-field">
            <label className="form-label">Select Date Range</label>
            <RangePicker
              startDate={rangeStart}
              endDate={rangeEnd}
              onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
            />
          </div>

          <div className="form-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Available Time Window</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#888' }}>All Day</span>
                <div onClick={() => setAllDay(v => !v)} style={{ width: 40, height: 24, borderRadius: 12, background: allDay ? '#8a9da8' : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: allDay ? 18 : 2, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </div>
            </div>
            <div style={{ opacity: allDay ? 0.45 : 1, pointerEvents: allDay ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
              <TimeRangeSlider
                startSlot={allDay ? 0 : startSlot}
                endSlot={allDay ? SLIDER_TOTAL : endSlot}
                onChange={(s, e) => { setStartSlot(s); setEndSlot(e); }}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Duration</label>
            <DurationSlider value={duration} onChange={setDuration} />
          </div>

          <div className="form-field">
            <label className="form-label">Survey Deadline</label>
            <div style={{ position: 'relative' }} onClick={() => setShowDeadlineSheet(true)}>
              <div className="form-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: deadlineDate ? '#111' : '#BEC0C4', paddingRight: 36 }}>
                {deadlineDate ? formatDate(deadlineDate) : 'Select date'}
              </div>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
            </div>
          </div>

        </div>

        <div style={{ padding: '4px 16px 32px' }}>
          <button className="btn-primary" onClick={() => navigate('/grid', { state: { rangeStart: rangeStart?.getTime() ?? null, rangeEnd: rangeEnd?.getTime() ?? null, startSlot, endSlot, allDay } })}>
            Submit
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {showDeadlineSheet && (
        <DatePickerSheet selected={deadlineDate} onSelect={setDeadlineDate} onClose={() => setShowDeadlineSheet(false)} />
      )}
    </div>
  );
}
