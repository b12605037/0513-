import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IcChevron } from '../components/Icons';
import mixpanel from '../lib/mixpanel';

// ── Constants ─────────────────────────────────────────────────────────────────
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

function formatDate(date) {
  if (!date) return '';
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function fmtDuration(d) {
  const n = Number(d);
  if (n === 0) return '不限時長';
  if (n < 60) return `${n} min`;
  if (n % 60 === 0) return `${n / 60} hr`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DURATION_TOTAL = 48;
const dSlotToMins = (slot) => slot * 30;
const dMinsToSlot = (mins) => Math.round(Math.max(0, Math.min(DURATION_TOTAL, mins / 30)));
const DURATION_TICKS = [
  { label: '不限', slot: 0 },
  { label: '2h',   slot: 4 },
  { label: '4h',   slot: 8 },
  { label: '8h',   slot: 16 },
  { label: '12h',  slot: 24 },
  { label: '24h',  slot: 48 },
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
        <div style={{ fontSize: 35, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtDuration(value)}</div>
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
            <span key={label} style={{ position: 'absolute', left: `${pct}%`, transform, fontSize: 13, color: '#CCC', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
          );
        })}
      </div>
    </div>
  );
}

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
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtSlot(startSlot)} <span style={{ fontSize: 16, fontWeight: 600 }}>{fmtPeriod(startSlot)}</span></div>
        </div>
        <div style={{ color: '#CCC', fontSize: 25 }}>→</div>
        <div style={{ flex: 1, background: '#e8eef1', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtSlot(endSlot)} <span style={{ fontSize: 16, fontWeight: 600 }}>{fmtPeriod(endSlot)}</span></div>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#CCC', fontWeight: 500, paddingLeft: 2, paddingRight: 2 }}>
        {TICK_LABELS.map(t => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

function DateMultiPicker({ selectedDates, onChange }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const mkKey  = (dt) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  const fromKey = (k)  => { const [y,m,d] = k.split('-').map(Number); return new Date(y,m,d); };

  const [viewYear,  setViewYear]  = useState(() => selectedDates?.[0]?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDates?.[0]?.getMonth()    ?? today.getMonth());

  const [displaySet, setDisplaySet] = useState(() => {
    const s = new Set(); selectedDates?.forEach(d => s.add(mkKey(d))); return s;
  });

  const dragging      = useRef(false);
  const workSet       = useRef(new Set());
  const dragMode      = useRef(null);
  const displaySetRef = useRef(displaySet);
  const onChangeRef   = useRef(onChange);
  const calRef        = useRef(null);

  useEffect(() => { displaySetRef.current = displaySet; }, [displaySet]);
  useEffect(() => { onChangeRef.current   = onChange;   }, [onChange]);

  useEffect(() => {
    if (dragging.current) return;
    const s = new Set(); selectedDates?.forEach(d => s.add(mkKey(d)));
    setDisplaySet(s);
  }, [selectedDates]);

  useEffect(() => {
    const el = calRef.current;
    if (!el) return;
    const getKey = (cx, cy) =>
      document.elementFromPoint(cx, cy)?.closest('[data-dkey]')?.dataset?.dkey ?? null;
    const paint = (key) => {
      if (!dragMode.current) return;
      const dt = fromKey(key);
      if (dt < today) return;
      workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
      setDisplaySet(new Set(workSet.current));
    };
    const onStart = (e) => {
      e.preventDefault();
      document.body.style.overflow = 'hidden';
      const key = e.target.closest('[data-dkey]')?.dataset?.dkey ?? null;
      if (!key) return;
      const dt = fromKey(key);
      if (dt < today) return;
      dragging.current = true;
      workSet.current  = new Set(displaySetRef.current);
      dragMode.current = workSet.current.has(key) ? 'deselect' : 'select';
      paint(key);
    };
    const onMove = (e) => {
      e.preventDefault();
      if (!dragMode.current) return;
      const { clientX, clientY } = e.touches[0];
      const key = getKey(clientX, clientY);
      if (key) paint(key);
    };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
    };
  }, [today]);

  useEffect(() => {
    const commit = () => {
      if (!dragging.current) return;
      dragging.current = false;
      dragMode.current = null;
      document.body.style.overflow = '';
      const dates = Array.from(workSet.current).map(fromKey).sort((a, b) => a - b);
      onChangeRef.current(dates);
    };
    window.addEventListener('touchend', commit);
    window.addEventListener('mouseup',  commit);
    return () => {
      window.removeEventListener('touchend', commit);
      window.removeEventListener('mouseup',  commit);
      document.body.style.overflow = '';
    };
  }, []);

  const mouseDown = (key) => {
    const dt = fromKey(key);
    if (dt < today) return;
    dragging.current = true;
    workSet.current  = new Set(displaySetRef.current);
    dragMode.current = workSet.current.has(key) ? 'deselect' : 'select';
    workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
    setDisplaySet(new Set(workSet.current));
  };
  const mouseEnter = (key) => {
    if (!dragging.current || !dragMode.current) return;
    const dt = fromKey(key);
    if (dt < today) return;
    workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
    setDisplaySet(new Set(workSet.current));
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const count       = displaySet.size;
  const label = count === 0
    ? '點擊或滑動選取日期'
    : (() => { const d = fromKey([...displaySet][0]); return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })();
  const sortedDates = count > 1
    ? Array.from(displaySet).map(fromKey).sort((a, b) => a - b)
    : [];
  const dateRanges = sortedDates.reduce((acc, d) => {
    if (!acc.length || (d - acc[acc.length - 1][1]) / 86400000 !== 1) return [...acc, [d, d]];
    return [...acc.slice(0, -1), [acc[acc.length - 1][0], d]];
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '10px 16px 8px', background: '#F8FFFE', borderBottom: '1px solid #F0F0F0' }}>
        {count <= 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: count > 0 ? '#8A9DA8' : '#FFB300', flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: count > 0 ? '#8A9DA8' : '#F57F17' }}>{label}</span>
            {count > 0 && (
              <button onClick={() => onChangeRef.current([])} style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 600, color: '#E57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#8A9DA8', flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
              {dateRanges.map(([s, e], i) => {
                const label = s.getTime() === e.getTime()
                  ? `${s.getMonth()+1}/${s.getDate()}`
                  : s.getMonth() === e.getMonth()
                  ? `${s.getMonth()+1}/${s.getDate()}–${e.getDate()}`
                  : `${s.getMonth()+1}/${s.getDate()}–${e.getMonth()+1}/${e.getDate()}`;
                return (
                  <span key={i} style={{ fontSize: 13, fontWeight: 600, color: '#8A9DA8', background: '#e8eef1', borderRadius: 5, padding: '2px 7px' }}>
                    {label}
                  </span>
                );
              })}
            </div>
            <button onClick={() => onChangeRef.current([])} style={{ flexShrink: 0, fontSize: 15, fontWeight: 600, color: '#E57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8A9DA8' }}><IcChevron dir="left" size={16} /></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#8A9DA8' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#8A9DA8' }}><IcChevron dir="right" size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
          {DAY_LABELS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#91AEC4', padding: '3px 0' }}>{d}</div>)}
        </div>
        <div ref={calRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', userSelect: 'none' }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dt       = new Date(viewYear, viewMonth, d);
            const key      = mkKey(dt);
            const disabled = dt < today;
            const selected = displaySet.has(key);
            const isToday  = sameDay(dt, today);
            return (
              <div key={d}
                data-dkey={disabled ? undefined : key}
                onMouseDown={() => !disabled && mouseDown(key)}
                onMouseEnter={() => !disabled && mouseEnter(key)}
                style={{ height: 36, cursor: disabled ? 'default' : 'pointer' }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 16, margin: '2px auto 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? '#8A9DA8' : 'transparent',
                  border: isToday && !selected ? '1.5px solid #8A9DA8' : 'none',
                  fontSize: 16, fontWeight: selected ? 700 : 400,
                  color: selected ? '#fff' : disabled ? '#DDD' : '#8A9DA8',
                  transition: 'background 0.08s',
                }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TIMEZONES = [
  { region: '
