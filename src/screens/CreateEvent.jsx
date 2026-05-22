import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IcChevron } from '../components/Icons';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// Time slider: 0:00 – 24:00, 30-min steps, 48 total slots
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

// Duration slider: 30 min – 24h (1440 min), 30-min steps (slots 0–47)
const DURATION_TOTAL = 47;
const dSlotToMins = (slot) => 30 + slot * 30;
const dMinsToSlot = (mins) => Math.round(Math.max(0, Math.min(DURATION_TOTAL, (mins - 30) / 30)));
const DURATION_TICKS = [
  { label: '30m', slot: 0 },
  { label: '2h',  slot: 3 },
  { label: '4h',  slot: 7 },
  { label: '8h',  slot: 15 },
  { label: '12h', slot: 23 },
  { label: '24h', slot: 47 },
];

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
        <div style={{ fontSize: 28, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtDuration(value)}</div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px', touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, top: 0, bottom: 0, background: '#8A9DA8', borderRadius: 3 }} />
        <div
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          style={{ position: 'absolute', left: `calc(${pct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }}
        />
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        {DURATION_TICKS.map(({ label, slot }, i) => {
          const pct = (slot / DURATION_TOTAL) * 100;
          const transform = i === 0 ? 'none' : i === DURATION_TICKS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)';
          return (
            <span key={label} style={{ position: 'absolute', left: `${pct}%`, transform, fontSize: 10, color: '#CCC', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
          );
        })}
      </div>
    </div>
  );
}

// ── Draggable time range slider (24h) ─────────────────────────────────────────
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
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtSlot(startSlot)} <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtPeriod(startSlot)}</span></div>
        </div>
        <div style={{ color: '#CCC', fontSize: 20 }}>→</div>
        <div style={{ flex: 1, background: '#e8eef1', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtSlot(endSlot)} <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtPeriod(endSlot)}</span></div>
        </div>
      </div>

      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px', touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: `${sPct}%`, width: `${ePct - sPct}%`, top: 0, bottom: 0, background: '#8A9DA8', borderRadius: 3 }} />
        <div
          onMouseDown={startDrag('start')}
          onTouchStart={startDrag('start')}
          style={{ position: 'absolute', left: `calc(${sPct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }}
        />
        <div
          onMouseDown={startDrag('end')}
          onTouchStart={startDrag('end')}
          style={{ position: 'absolute', left: `calc(${ePct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#CCC', fontWeight: 500, paddingLeft: 2, paddingRight: 2 }}>
        {TICK_LABELS.map(t => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

// ── Date range picker with drag-to-select ─────────────────────────────────────
function RangePicker({ startDate, endDate, onChange }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(startDate ? startDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(startDate ? startDate.getMonth() : today.getMonth());

  // Drag state — refs for stable event handler closures, state for rendering
  const isDown = useRef(false);
  const anchorRef = useRef(null);
  const liveRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const calGridRef = useRef(null);
  useEffect(() => {
    const el = calGridRef.current;
    if (!el) return;
    const onStart = (e) => {
      const cel = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      if (cel?.closest?.('[data-day]')) e.preventDefault();
    };
    const onMove = (e) => {
      if (!isDown.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const cel = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = cel?.closest?.('[data-day]');
      if (!cell) return;
      const d = parseInt(cell.getAttribute('data-day'));
      if (!d) return;
      const dt = new Date(viewYear, viewMonth, d);
      if (dt < today) return;
      liveRef.current = dt;
      setDragLive(dt);
    };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [viewYear, viewMonth]);

  const [dragAnchor, setDragAnchor] = useState(null);
  const [dragLive, setDragLive] = useState(null);

  // Commit on global mouseup / touchend
  useEffect(() => {
    const commit = () => {
      if (!isDown.current) return;
      isDown.current = false;
      const anchor = anchorRef.current;
      const live = liveRef.current || anchor;
      anchorRef.current = null;
      liveRef.current = null;
      setDragAnchor(null);
      setDragLive(null);
      if (!anchor || !live) return;
      const [s, e] = anchor <= live ? [anchor, live] : [live, anchor];
      onChangeRef.current(s, e);
    };
    window.addEventListener('mouseup', commit);
    window.addEventListener('touchend', commit);
    return () => {
      window.removeEventListener('mouseup', commit);
      window.removeEventListener('touchend', commit);
    };
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const dateFromCell = (d) => new Date(viewYear, viewMonth, d);

  const handleMouseDown = (d) => {
    const dt = dateFromCell(d);
    if (dt < today) return;
    // Cross-month drag: lock anchor to original startDate so user can drag end in this month
    const inDifferentMonth = startDate &&
      (viewYear !== startDate.getFullYear() || viewMonth !== startDate.getMonth());
    if (inDifferentMonth && dt > startDate) {
      isDown.current = true;
      anchorRef.current = startDate;
      liveRef.current = dt;
      setDragAnchor(startDate);
      setDragLive(dt);
      return;
    }
    isDown.current = true;
    anchorRef.current = dt;
    liveRef.current = dt;
    setDragAnchor(dt);
    setDragLive(dt);
  };

  const handleMouseEnter = (d) => {
    if (!isDown.current) return;
    const dt = dateFromCell(d);
    if (dt < today) return;
    liveRef.current = dt;
    setDragLive(dt);
  };

  // Touch: touchmove fires on original element, so use elementFromPoint
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
    liveRef.current = dt;
    setDragLive(dt);
  };

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Normalise direction for display
  const isDragging = dragAnchor !== null;
  const effStart = isDragging
    ? (dragAnchor <= (dragLive || dragAnchor) ? dragAnchor : (dragLive || dragAnchor))
    : startDate;
  const effEnd = isDragging
    ? (dragAnchor <= (dragLive || dragAnchor) ? (dragLive || dragAnchor) : dragAnchor)
    : endDate;

  const classFor = (d) => {
    const dt = dateFromCell(d);
    const disabled = dt < today;
    const isStart = sameDay(dt, effStart);
    const isEnd = sameDay(dt, effEnd);
    const inRange = effStart && effEnd && dt > effStart && dt < effEnd;
    const isToday = sameDay(dt, today);
    return { dt, disabled, isStart, isEnd, inRange, isToday };
  };

  const phase = isDragging ? 'dragging' : !startDate ? 'empty' : 'done';
  const phaseLabel = isDragging
    ? (effStart && effEnd && !sameDay(effStart, effEnd)
        ? `${SHORT_MONTHS[effStart.getMonth()]} ${effStart.getDate()} – ${SHORT_MONTHS[effEnd.getMonth()]} ${effEnd.getDate()}`
        : `${SHORT_MONTHS[effStart.getMonth()]} ${effStart.getDate()}`)
    : phase === 'empty'
    ? '點按並拖曳以選取日期'
    : (startDate && endDate && !sameDay(startDate, endDate))
      ? `${SHORT_MONTHS[startDate.getMonth()]} ${startDate.getDate()} – ${SHORT_MONTHS[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`
      : startDate
      ? `${SHORT_MONTHS[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}`
      : '點按並拖曳以選取日期';

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', overflow: 'hidden', marginBottom: 16, touchAction: 'none' }}>
      <div style={{ padding: '10px 16px 8px', background: '#F8FFFE', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: phase === 'done' ? '#8A9DA8' : phase === 'dragging' ? '#8A9DA8' : '#FFB300', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: phase === 'done' || phase === 'dragging' ? '#8A9DA8' : '#F57F17' }}>{phaseLabel}</span>
        {phase === 'done' && (
          <button onClick={() => onChange(null, null)} style={{ marginLeft: 'auto', fontSize: 11, color: '#BBB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>
        )}
      </div>

      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8A9DA8' }}>
            <IcChevron dir="left" size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8A9DA8' }}>
            <IcChevron dir="right" size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#BBB', padding: '3px 0' }}>{d}</div>
          ))}
        </div>

        <div
          ref={calGridRef}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', userSelect: 'none', touchAction: 'none' }}
        >
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const { disabled, isStart, isEnd, inRange, isToday } = classFor(d);
            const isSingleDay = isStart && effEnd && sameDay(effStart, effEnd);
            return (
              <div
                key={d}
                data-day={d}
                onMouseDown={() => handleMouseDown(d)}
                onMouseEnter={() => handleMouseEnter(d)}
                onTouchStart={() => handleMouseDown(d)}
                style={{ position: 'relative', height: 36, cursor: disabled ? 'default' : 'pointer' }}
              >
                {inRange && <div style={{ position: 'absolute', inset: 0, background: '#e8eef1' }} />}
                {isStart && effEnd && !isSingleDay && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', background: '#e8eef1' }} />}
                {isEnd && effStart && !sameDay(effStart, effEnd) && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: '#e8eef1' }} />}
                <div style={{
                  position: 'relative', zIndex: 1,
                  width: 32, height: 32, borderRadius: 16, margin: '2px auto 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isStart || isEnd ? '#8A9DA8' : 'transparent',
                  border: isToday && !isStart && !isEnd ? '1.5px solid #8A9DA8' : 'none',
                  fontSize: 13,
                  fontWeight: isStart || isEnd || inRange ? 600 : 400,
                  color: isStart || isEnd ? '#fff' : disabled ? '#DDD' : isToday ? '#8A9DA8' : inRange ? '#8A9DA8' : '#111',
                  transition: 'background 0.1s',
                }}>
                  {d}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Survey deadline date picker (bottom sheet) ────────────────────────────────
function DatePickerSheet({ selected, onSelect, onClose }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const isSelected = (d) =>
    selected && selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth && selected.getDate() === d;

  const isToday = (d) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>回覆截止日</div>
          {selected && <div style={{ fontSize: 13, fontWeight: 600, color: '#8A9DA8' }}>{formatDate(selected)}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8A9DA8' }}>
            <IcChevron dir="left" size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8A9DA8' }}>
            <IcChevron dir="right" size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#BBB', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px 0', marginBottom: 8 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const sel = isSelected(d);
            const todayMark = isToday(d);
            return (
              <div key={d} onClick={() => { onSelect(new Date(viewYear, viewMonth, d)); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, cursor: 'pointer' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: sel ? '#8A9DA8' : 'transparent',
                  border: todayMark && !sel ? '1.5px solid #8A9DA8' : 'none',
                  fontSize: 14, fontWeight: sel || todayMark ? 700 : 400,
                  color: sel ? '#fff' : todayMark ? '#8A9DA8' : '#111',
                  transition: 'background 0.12s',
                }}>
                  {d}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Timezone picker (bottom sheet) ────────────────────────────────────────────
const TIMEZONES = [
  { region: '自動偵測', zones: [
    { label: 'Local', sub: '使用裝置時區', value: 'local', offset: '' },
  ]},
  { region: '美洲', zones: [
    { label: 'America/Los_Angeles', sub: '太平洋時間 — 洛杉磯',  value: 'America/Los_Angeles', offset: 'UTC−8' },
    { label: 'America/Denver',      sub: '山地時間 — 丹佛',      value: 'America/Denver',       offset: 'UTC−7' },
    { label: 'America/Chicago',     sub: '中部時間 — 芝加哥',    value: 'America/Chicago',      offset: 'UTC−6' },
    { label: 'America/New_York',    sub: '東部時間 — 紐約',      value: 'America/New_York',     offset: 'UTC−5' },
    { label: 'America/Halifax',     sub: '大西洋時間 — 哈利法克斯', value: 'America/Halifax',   offset: 'UTC−4' },
    { label: 'America/Sao_Paulo',   sub: '巴西利亞 — 聖保羅',   value: 'America/Sao_Paulo',    offset: 'UTC−3' },
  ]},
  { region: '歐洲與非洲', zones: [
    { label: 'UTC',                 sub: '世界協調時間',         value: 'UTC',                  offset: 'UTC+0' },
    { label: 'Europe/London',       sub: '倫敦、都柏林',         value: 'Europe/London',        offset: 'UTC+0' },
    { label: 'Europe/Paris',        sub: '巴黎、柏林、羅馬',    value: 'Europe/Paris',         offset: 'UTC+1' },
    { label: 'Europe/Helsinki',     sub: '赫爾辛基、基輔、開羅', value: 'Europe/Helsinki',      offset: 'UTC+2' },
    { label: 'Europe/Moscow',       sub: '莫斯科、聖彼得堡',    value: 'Europe/Moscow',        offset: 'UTC+3' },
  ]},
  { region: '中東與亞洲', zones: [
    { label: 'Asia/Dubai',          sub: '杜拜、阿布達比',       value: 'Asia/Dubai',           offset: 'UTC+4' },
    { label: 'Asia/Kolkata',        sub: '孟買、加爾各答、欽奈', value: 'Asia/Kolkata',         offset: 'UTC+5:30' },
    { label: 'Asia/Dhaka',          sub: '達卡、孟加拉',         value: 'Asia/Dhaka',           offset: 'UTC+6' },
    { label: 'Asia/Bangkok',        sub: '曼谷、河內、雅加達',   value: 'Asia/Bangkok',         offset: 'UTC+7' },
    { label: 'Asia/Shanghai',       sub: '北京、上海、重慶',     value: 'Asia/Shanghai',        offset: 'UTC+8' },
    { label: 'Asia/Taipei',         sub: '台北、台灣',           value: 'Asia/Taipei',          offset: 'UTC+8' },
    { label: 'Asia/Hong_Kong',      sub: '香港',                 value: 'Asia/Hong_Kong',       offset: 'UTC+8' },
    { label: 'Asia/Singapore',      sub: '新加坡、吉隆坡',       value: 'Asia/Singapore',       offset: 'UTC+8' },
    { label: 'Asia/Seoul',          sub: '首爾、韓國',           value: 'Asia/Seoul',           offset: 'UTC+9' },
    { label: 'Asia/Tokyo',          sub: '東京、大阪、札幌',     value: 'Asia/Tokyo',           offset: 'UTC+9' },
  ]},
  { region: '太平洋地區', zones: [
    { label: 'Australia/Sydney',    sub: '雪梨、墨爾本',         value: 'Australia/Sydney',     offset: 'UTC+10' },
    { label: 'Pacific/Auckland',    sub: '奧克蘭、威靈頓',       value: 'Pacific/Auckland',     offset: 'UTC+12' },
  ]},
];

function TimezoneSheet({ current, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return TIMEZONES;
    const q = query.toLowerCase();
    return TIMEZONES.map(group => ({
      ...group,
      zones: group.zones.filter(z =>
        z.label.toLowerCase().includes(q) ||
        z.value.toLowerCase().includes(q) ||
        z.sub.toLowerCase().includes(q) ||
        z.offset.toLowerCase().includes(q)
      ),
    })).filter(g => g.zones.length > 0);
  }, [query]);

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 0 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 14 }}>選擇時區</div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#BBB' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input autoFocus className="form-input" placeholder="搜尋時區…" value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 36, paddingTop: 10, paddingBottom: 10 }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 34 }}>
          {filtered.map(group => (
            <div key={group.region}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#BBB', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 0 6px' }}>{group.region}</div>
              {group.zones.map(tz => {
                const isSelected = current === tz.label;
                return (
                  <div key={tz.value} onClick={() => onSelect(tz)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#8A9DA8' : '#111', fontFamily: 'monospace' }}>{tz.label}</div>
                      <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{tz.sub}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      {tz.offset && <span style={{ fontSize: 12, fontWeight: 500, color: '#BBB' }}>{tz.offset}</span>}
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9DA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showTzSheet, setShowTzSheet] = useState(false);
  const [showDeadlineSheet, setShowDeadlineSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const meetingIdRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(new Date(2026, 4, 9));
  const [rangeStart, setRangeStart] = useState(new Date(2026, 4, 5));
  const [rangeEnd, setRangeEnd] = useState(new Date(2026, 4, 9));
  const [startSlot, setStartSlot] = useState(18); // 9:00 AM
  const [endSlot, setEndSlot] = useState(36);     // 6:00 PM
  const [form, setForm] = useState({
    name: 'Q2 Planning Kickoff',
    duration: 60,
    timezone: 'Asia/Taipei',
    timezoneOffset: 'UTC+8',
    allDay: false,
  });
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTzSelect = (tz) => {
    up('timezone', tz.label);
    up('timezoneOffset', tz.offset);
    setShowTzSheet(false);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSendInvite = async () => {
    setSubmitting(true);
    const id = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from('meetings').insert({
      id,
      name: form.name,
      range_start: rangeStart?.getTime() ?? null,
      range_end:   rangeEnd?.getTime()   ?? null,
      start_slot:  startSlot,
      end_slot:    endSlot,
      all_day:     form.allDay,
      duration:    form.duration,
      timezone:    form.timezone,
      timezone_offset: form.timezoneOffset,
      deadline:    deadlineDate?.getTime() ?? null,
    });
    setSubmitting(false);
    if (error) { alert('儲存失敗：' + error.message); return; }
    meetingIdRef.current = id;
    setShowShareModal(true);
  };

  const displayLink = meetingIdRef.current ? `meetime-sigma.vercel.app/join/${meetingIdRef.current}` : '';
  const shareLink   = meetingIdRef.current ? `https://meetime-sigma.vercel.app/join/${meetingIdRef.current}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleShareLine = () => {
    window.open(`line://msg/text/${encodeURIComponent(shareLink)}`);
  };

  const handleShareOther = () => {
    if (navigator.share) {
      navigator.share({ title: form.name || 'meetime', url: shareLink }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <>
    <div className="app-container" style={{ position: 'relative' }}>
      <div className="app-nav">
        {step > 1
          ? <button className="nav-back" onClick={() => setStep(s => s - 1)}>
              <IcChevron dir="left" /> 返回
            </button>
          : <span style={{ width: 60 }} />
        }
        <span className="nav-title">新增活動</span>
        <button className="nav-action" onClick={() => navigate('/')}>取消</button>
      </div>

      <div className="steps">
        {[1, 2].map(i => (
          <div key={i} className={`step-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
        ))}
      </div>

      <div className="screen-content">
        {step === 1 && (
          <div>
            <div className="section-head" style={{ paddingTop: 16 }}>
              <h2>活動資訊</h2>
              <p>這次要安排什麼會議？</p>
            </div>
            <div style={{ padding: '0 16px' }}>
              <div className="form-field">
                <label className="form-label">活動名稱</label>
                <input className="form-input" value={form.name} onChange={e => up('name', e.target.value)} placeholder="例：週會、團隊討論" />
              </div>
              <div className="form-field">
                <label className="form-label">活動時長</label>
                <DurationSlider value={form.duration} onChange={(v) => up('duration', v)} />
              </div>
              <div className="form-field">
                <label className="form-label">時區</label>
                <div style={{ position: 'relative' }} onClick={() => setShowTzSheet(true)}>
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingRight: 36 }}>
                    <span style={{ color: '#111' }}>{form.timezone}</span>
                    {form.timezoneOffset && <span style={{ color: '#AAA', fontSize: 13, marginLeft: 8 }}>{form.timezoneOffset}</span>}
                  </div>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#BBB', pointerEvents: 'none' }}>
                    <IcChevron dir="down" size={14} />
                  </span>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">回覆截止日</label>
                <div style={{ position: 'relative' }} onClick={() => setShowDeadlineSheet(true)}>
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: deadlineDate ? '#111' : '#BEC0C4', paddingRight: 36 }}>
                    {deadlineDate ? formatDate(deadlineDate) : '選取日期'}
                  </div>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="section-head" style={{ paddingTop: 16 }}>
              <h2>候選日期</h2>
              <p>會議可能在哪幾天進行？</p>
            </div>
            <div style={{ padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 14, border: '1.5px solid #F0F0F0' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>全天</div>
                </div>
                <div onClick={() => up('allDay', !form.allDay)} style={{ width: 44, height: 26, borderRadius: 13, background: form.allDay ? '#8A9DA8' : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: form.allDay ? 20 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </div>

              {!form.allDay && (
                <div className="form-field">
                  <label className="form-label">選取調查時段</label>
                  <TimeRangeSlider
                    startSlot={startSlot}
                    endSlot={endSlot}
                    onChange={(s, e) => { setStartSlot(s); setEndSlot(e); }}
                  />
                </div>
              )}

              <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>選取日期範圍</label>
              <RangePicker
                startDate={rangeStart}
                endDate={rangeEnd}
                onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
              />
            </div>
          </div>
        )}

        <div style={{ padding: '8px 16px 32px' }}>
          {step < 2
            ? <button className="btn-primary" onClick={() => setStep(s => s + 1)}>
                下一步 <IcChevron dir="right" size={16} />
              </button>
            : <button className="btn-primary" onClick={handleSendInvite} disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
                {submitting ? '儲存中…' : '送出邀請'}
                {!submitting && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>}
              </button>
          }
        </div>
      </div>

      {showTzSheet && (
        <TimezoneSheet current={form.timezone} onSelect={handleTzSelect} onClose={() => setShowTzSheet(false)} />
      )}
      {showDeadlineSheet && (
        <DatePickerSheet selected={deadlineDate} onSelect={setDeadlineDate} onClose={() => setShowDeadlineSheet(false)} />
      )}

    </div>

    {showShareModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '22px 20px 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>

            {/* Header: icon + title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E8EEF1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A9DA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>確認活動資訊</div>
                <div style={{ fontSize: 12, color: '#AAA', marginTop: 3, lineHeight: 1.4 }}>分享連結給大家填寫空閒時間</div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#F0F0F0', marginBottom: 14 }} />

            {/* Info rows */}
            {[
              { label: '調查時段', value: rangeStart && rangeEnd
                  ? (sameDay(rangeStart, rangeEnd)
                      ? `${SHORT_MONTHS[rangeStart.getMonth()]} ${rangeStart.getDate()}`
                      : `${SHORT_MONTHS[rangeStart.getMonth()]} ${rangeStart.getDate()} – ${SHORT_MONTHS[rangeEnd.getMonth()]} ${rangeEnd.getDate()}`)
                  : '未設定' },
              { label: '活動時長', value: fmtDuration(form.duration) },
              { label: '截止日',   value: deadlineDate ? formatDate(deadlineDate) : '未設定' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#AAA', fontWeight: 400 }}>{label}</span>
                <span style={{ fontSize: 13, color: '#111', fontWeight: 700 }}>{value}</span>
              </div>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: '#F0F0F0', margin: '14px 0' }} />

            {/* Link block */}
            <div style={{ background: '#E8EEF1', borderRadius: 12, padding: '10px 8px 10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, fontSize: 12, color: '#5F84A2', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayLink}
              </div>
              <button onClick={handleCopy} style={{
                flexShrink: 0, padding: '7px 13px', borderRadius: 9, border: 'none',
                background: copied ? '#5F84A2' : '#2F4156',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap',
              }}>
                {copied ? '已複製 ✓' : '複製'}
              </button>
            </div>

            {/* Share buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={handleShareLine} style={{
                flex: 1, padding: '13px 8px', borderRadius: 12, border: 'none',
                background: '#06C755', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                傳送至 LINE
              </button>
              <button onClick={handleShareOther} style={{
                flex: 1, padding: '13px 8px', borderRadius: 12, border: 'none',
                background: '#F0F0F0', color: '#555', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                其他分享
              </button>
            </div>

            {/* Back button */}
            <button onClick={() => setShowShareModal(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#BBB', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              ← 返回修改
            </button>
          </div>
        </div>
      )}
    </>
  );
}
