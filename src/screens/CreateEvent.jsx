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
        <div style={{ fontSize: 21, fontWeight: 700, color: '#111', marginBottom: 14 }}>選擇時區</div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#BBB' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input autoFocus className="form-input" placeholder="搜尋時區…" value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 36, paddingTop: 10, paddingBottom: 10 }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 34 }}>
          {filtered.map(group => (
            <div key={group.region}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#BBB', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 0 6px' }}>{group.region}</div>
              {group.zones.map(tz => {
                const isSelected = current === tz.label;
                return (
                  <div key={tz.value} onClick={() => onSelect(tz)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#8A9DA8' : '#111', fontFamily: 'monospace' }}>{tz.label}</div>
                      <div style={{ fontSize: 15, color: '#AAA', marginTop: 2 }}>{tz.sub}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      {tz.offset && <span style={{ fontSize: 15, fontWeight: 500, color: '#BBB' }}>{tz.offset}</span>}
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

export default function CreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showTzSheet, setShowTzSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const meetingIdRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [selectedDates, setSelectedDates] = useState(() => {
    const days = [];
    for (let d = 5; d <= 9; d++) days.push(new Date(2026, 4, d));
    return days;
  });
  const [startSlot, setStartSlot] = useState(18);
  const [endSlot, setEndSlot] = useState(36);
  const [dateError, setDateError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [form, setForm] = useState({
    name: 'Q2 Planning Kickoff',
    duration: 0,
    timezone: 'Asia/Taipei',
    timezoneOffset: 'UTC+8',
    allDay: false,
  });
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Mixpanel: 頁面瀏覽 ──
  useEffect(() => {
    mixpanel.track('頁面瀏覽', { 頁面: '新增活動' });
  }, []);

  const handleTzSelect = (tz) => {
    up('timezone', tz.label);
    up('timezoneOffset', tz.offset);
    setShowTzSheet(false);
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSendInvite = async () => {
    const dErr = selectedDates.length === 0;
    const tErr = !form.allDay && startSlot >= endSlot;
    setDateError(dErr);
    setTimeError(tErr);
    if (dErr || tErr) return;

    // ── Mixpanel: 新增活動_送出邀請 ──
    mixpanel.track('新增活動_送出邀請', {
      活動名稱: form.name,
      日期數量: selectedDates.length,
      時段: form.allDay ? '全天' : `${fmtSlot(startSlot)}-${fmtSlot(endSlot)}`,
      有設定時長: form.duration > 0,
    });

    setSubmitting(true);
    setSubmitError('');
    const id = Math.random().toString(36).slice(2, 10);
    const rangeStart = selectedDates[0] ?? null;
    const rangeEnd   = selectedDates[selectedDates.length - 1] ?? null;
    const payload = {
      id,
      name: form.name,
      range_start: rangeStart?.getTime() ?? null,
      range_end:   rangeEnd?.getTime()   ?? null,
      date_list:   selectedDates.map(d => d.getTime()),
      start_slot:  startSlot,
      end_slot:    endSlot,
      all_day:     form.allDay,
      duration:    form.duration,
      timezone:    form.timezone,
      timezone_offset: form.timezoneOffset,
    };
    let { error } = await supabase.from('meetings').insert(payload);
    if (error && error.message?.includes('date_list')) {
      const { date_list, ...payloadWithout } = payload;
      ({ error } = await supabase.from('meetings').insert(payloadWithout));
    }
    setSubmitting(false);
    if (error) { setSubmitError(error.message); return; }
    try {
      const prev = JSON.parse(localStorage.getItem('meetime_recent') || '[]');
      prev.unshift({ id, name: form.name, time: Date.now() });
      localStorage.setItem('meetime_recent', JSON.stringify(prev.slice(0, 10)));
    } catch {}
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
    // ── Mixpanel: 分享至LINE ──
    mixpanel.track('分享至LINE', { 來源: 'create_event', 活動id: meetingIdRef.current });
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
                <label className="form-label">預計會議時長（選填）</label>
                <DurationSlider value={form.duration} onChange={(v) => up('duration', v)} />
              </div>
              <div className="form-field">
                <label className="form-label">時區</label>
                <div style={{ position: 'relative' }} onClick={() => setShowTzSheet(true)}>
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingRight: 36 }}>
                    <span style={{ color: '#111' }}>{form.timezone}</span>
                    {form.timezoneOffset && <span style={{ color: '#AAA', fontSize: 16, marginLeft: 8 }}>{form.timezoneOffset}</span>}
                  </div>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#BBB', pointerEvents: 'none' }}>
                    <IcChevron dir="down" size={14} />
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
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#111' }}>全天</div>
                </div>
                <div onClick={() => up('allDay', !form.allDay)} style={{ width: 44, height: 26, borderRadius: 13, background: form.allDay ? '#8A9DA8' : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: form.allDay ? 20 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </div>

              {!form.allDay && (
                <div className="form-field">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>選取調查時段</label>
                    <span style={{ fontSize: 13, color: '#E57373', fontWeight: 600 }}>*</span>
                  </div>
                  <TimeRangeSlider
                    startSlot={startSlot}
                    endSlot={endSlot}
                    onChange={(s, e) => { setStartSlot(s); setEndSlot(e); setTimeError(false); }}
                  />
                  {timeError && (
                    <div style={{ fontSize: 14, color: '#E53935', marginTop: 8, background: '#FFF5F5', borderRadius: 8, padding: '8px 12px', border: '1px solid #FFCDD2' }}>
                      請選取調查時段
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>選取候選日期</label>
                <span style={{ fontSize: 13, color: '#E57373', fontWeight: 600 }}>*</span>
              </div>
              <DateMultiPicker
                selectedDates={selectedDates}
                onChange={(dates) => { setSelectedDates(dates); if (dates.length > 0) setDateError(false); }}
              />
              {dateError && (
                <div style={{ fontSize: 14, color: '#E53935', marginTop: -8, marginBottom: 10, background: '#FFF5F5', borderRadius: 8, padding: '8px 12px', border: '1px solid #FFCDD2' }}>
                  請選取日期
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '8px 16px 32px' }}>
          {submitError && (
            <div style={{ fontSize: 14, color: '#E53935', marginBottom: 10, background: '#FFF5F5', borderRadius: 8, padding: '8px 12px', border: '1px solid #FFCDD2' }}>
              儲存失敗：{submitError}
            </div>
          )}
          {step < 2
            ? <button className="btn-primary" onClick={() => {
                // ── Mixpanel: 新增活動_步驟切換 ──
                mixpanel.track('新增活動_步驟切換', { 步驟: step + 1 });
                setStep(s => s + 1);
              }}>
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
    </div>

    {showShareModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '22px 20px 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E8EEF1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A9DA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>確認活動資訊</div>
              <div style={{ fontSize: 15, color: '#AAA', marginTop: 3, lineHeight: 1.4 }}>分享連結給大家填寫空閒時間</div>
            </div>
          </div>

          <div style={{ height: 1, background: '#F0F0F0', marginBottom: 14 }} />

          {[
            { label: '調查時段', value: (() => {
                if (!selectedDates.length) return '未設定';
                const rs = selectedDates[0], re = selectedDates[selectedDates.length - 1];
                if (sameDay(rs, re)) return `${SHORT_MONTHS[rs.getMonth()]} ${rs.getDate()}`;
                if (selectedDates.length <= 3) return selectedDates.map(d => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`).join('、');
                return `${SHORT_MONTHS[rs.getMonth()]} ${rs.getDate()} – ${SHORT_MONTHS[re.getMonth()]} ${re.getDate()} (${selectedDates.length}天)`;
              })() },
            { label: '預計會議時長', value: fmtDuration(form.duration) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 16, color: '#AAA', fontWeight: 400 }}>{label}</span>
              <span style={{ fontSize: 16, color: '#111', fontWeight: 700 }}>{value}</span>
            </div>
          ))}

          <div style={{ height: 1, background: '#F0F0F0', margin: '14px 0' }} />

          <div style={{ background: '#E8EEF1', borderRadius: 12, padding: '10px 8px 10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, fontSize: 15, color: '#5F84A2', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayLink}
            </div>
            <button onClick={handleCopy} style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: 9, border: 'none',
              background: copied ? '#5F84A2' : '#2F4156',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap',
            }}>
              {copied ? '已複製 ✓' : '複製'}
            </button>
          </div>

          <button onClick={handleShareLine} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: '#8FA99A', color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            傳送至 LINE
          </button>

          <button onClick={() => setShowShareModal(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#BBB', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            ← 返回修改
          </button>
        </div>
      </div>
    )}
    </>
  );
}
