import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import mixpanel from '../lib/mixpanel';
import { IcChevron } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useDesktop } from '../hooks/useDesktop';

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
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
const DOT_COLORS = ['#D6DDD9', '#BFCCD4', '#9FB5C3', '#8A9DA8', '#6D7B86'];
const DURATION_TOTAL = 48;
const dSlotToMins = (slot) => slot * 30;
const dMinsToSlot = (mins) => Math.round(Math.max(0, Math.min(DURATION_TOTAL, mins / 30)));
const DURATION_TICKS = [
  { label: '0', slot: 0 },
  { label: '4h',   slot: 8 },
  { label: '8h',   slot: 16 },
  { label: '12h',  slot: 24 },
  { label: '24h',  slot: 48 },
];

function formatDate(date) {
  if (!date) return '';
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
function fmtDuration(d) {
  const n = Number(d);
  if (n === 0) return '0 hr';
  if (n < 60) return `${n} min`;
  if (n % 60 === 0) return `${n / 60} hr`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}
function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function DurationSlider({ value, onChange, onChangeEnd, scale = 1 }) {
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
    let lastSlot = getSlot(e);
    const move = (ev) => { lastSlot = getSlot(ev); onChange(dSlotToMins(lastSlot)); };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      onChangeEnd?.(dSlotToMins(lastSlot));
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
        <div style={{ fontSize: Math.round((Number(value) === 0 ? 36 : 55) * scale), fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em' }}>{fmtDuration(value)}</div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px' }}>
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, top: 0, bottom: 0, background: '#8A9DA8', borderRadius: 3 }} />
        <div onMouseDown={startDrag} onTouchStart={startDrag} style={{ position: 'absolute', left: `calc(${pct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
      </div>
      <div style={{ position: 'relative', height: 16, margin: '0 11px' }}>
        {DURATION_TICKS.map(({ label, slot: s }, i) => {
          const p = (s / DURATION_TOTAL) * 100;
          const transform = i === 0 ? 'none' : i === DURATION_TICKS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)';
          return <span key={label} style={{ position: 'absolute', left: `${p}%`, transform, fontSize: Math.round(19 * scale), color: '#CCC', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>;
        })}
      </div>
    </div>
  );
}

function TimeRangeSlider({ startSlot, endSlot, onChange, onChangeEnd, scale = 1 }) {
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
      onChangeEnd?.();
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
          <div style={{ fontSize: Math.round(24 * scale), fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{fmtSlot(startSlot)} <span style={{ fontSize: Math.round(14 * scale), fontWeight: 600 }}>{fmtPeriod(startSlot)}</span></div>
        </div>
        <div style={{ color: '#CCC', fontSize: Math.round(20 * scale), flexShrink: 0 }}>→</div>
        <div style={{ flex: 1, background: '#e8eef1', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: Math.round(24 * scale), fontWeight: 800, color: '#8A9DA8', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{fmtSlot(endSlot)} <span style={{ fontSize: Math.round(14 * scale), fontWeight: 600 }}>{fmtPeriod(endSlot)}</span></div>
        </div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 6, background: '#F0F0F0', borderRadius: 3, margin: '0 11px 14px' }}>
        <div style={{ position: 'absolute', left: `${sPct}%`, width: `${ePct - sPct}%`, top: 0, bottom: 0, background: '#8A9DA8', borderRadius: 3 }} />
        <div onMouseDown={startDrag('start')} onTouchStart={startDrag('start')} style={{ position: 'absolute', left: `calc(${sPct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
        <div onMouseDown={startDrag('end')} onTouchStart={startDrag('end')} style={{ position: 'absolute', left: `calc(${ePct}% - 11px)`, top: -8, width: 22, height: 22, borderRadius: 11, background: '#8A9DA8', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(138,157,168,0.45)', cursor: 'grab', zIndex: 2, touchAction: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: Math.round(19 * scale), color: '#CCC', fontWeight: 500, paddingLeft: 11, paddingRight: 11 }}>
        {TICK_LABELS.map(t => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

function DateMultiPicker({ selectedDates, onChange, large = false, scale = 1, fillHeight = false }) {
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
    const getKey = (cx, cy) => document.elementFromPoint(cx, cy)?.closest('[data-dkey]')?.dataset?.dkey ?? null;
    const paint = (key) => {
      if (!dragMode.current) return;
      const dt = fromKey(key); if (dt < today) return;
      workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
      setDisplaySet(new Set(workSet.current));
    };
    const onStart = (e) => {
      e.preventDefault();
      document.body.style.overflow = 'hidden';
      const key = e.target.closest('[data-dkey]')?.dataset?.dkey ?? null;
      if (!key) return;
      const dt = fromKey(key); if (dt < today) return;
      dragging.current = true;
      workSet.current  = new Set(displaySetRef.current);
      dragMode.current = workSet.current.has(key) ? 'deselect' : 'select';
      paint(key);
    };
    const onMove = (e) => {
      e.preventDefault();
      if (!dragMode.current) return;
      const { clientX, clientY } = e.touches[0];
      const key = getKey(clientX, clientY); if (key) paint(key);
    };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); };
  }, [today]);
  useEffect(() => {
    const commit = () => {
      if (!dragging.current) return;
      dragging.current = false; dragMode.current = null;
      document.body.style.overflow = '';
      onChangeRef.current(Array.from(workSet.current).map(fromKey).sort((a, b) => a - b));
    };
    window.addEventListener('touchend', commit);
    window.addEventListener('mouseup',  commit);
    return () => { window.removeEventListener('touchend', commit); window.removeEventListener('mouseup', commit); document.body.style.overflow = ''; };
  }, []);
  const mouseDown = (key) => {
    const dt = fromKey(key); if (dt < today) return;
    dragging.current = true;
    workSet.current  = new Set(displaySetRef.current);
    dragMode.current = workSet.current.has(key) ? 'deselect' : 'select';
    workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
    setDisplaySet(new Set(workSet.current));
  };
  const mouseEnter = (key) => {
    if (!dragging.current || !dragMode.current) return;
    const dt = fromKey(key); if (dt < today) return;
    workSet.current[dragMode.current === 'select' ? 'add' : 'delete'](key);
    setDisplaySet(new Set(workSet.current));
  };
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const count = displaySet.size;
  const label = count === 0 ? '點擊或滑動選取日期'
    : (() => { const d = fromKey([...displaySet][0]); return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })();
  const sortedDates = count > 1 ? Array.from(displaySet).map(fromKey).sort((a, b) => a - b) : [];
  const dateRanges = sortedDates.reduce((acc, d) => {
    if (!acc.length || (d - acc[acc.length - 1][1]) / 86400000 !== 1) return [...acc, [d, d]];
    return [...acc.slice(0, -1), [acc[acc.length - 1][0], d]];
  }, []);
  return (
    <div style={fillHeight ? {
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', overflow: 'hidden',
    } : {
      background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{ padding: '10px 28px 8px', background: '#F8FFFE', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
        {count <= 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: count > 0 ? '#8A9DA8' : '#FFB300', flexShrink: 0 }} />
            <span style={{ fontSize: Math.round(22 * scale), fontWeight: 600, color: count > 0 ? '#8A9DA8' : '#F57F17' }}>{label}</span>
            {count > 0 && <button onClick={() => onChangeRef.current([])} style={{ marginLeft: 'auto', fontSize: Math.round(22 * scale), fontWeight: 600, color: '#E57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#8A9DA8', flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
              {dateRanges.map(([s, e], i) => {
                const label = s.getTime() === e.getTime() ? `${s.getMonth()+1}/${s.getDate()}` : s.getMonth() === e.getMonth() ? `${s.getMonth()+1}/${s.getDate()}–${e.getDate()}` : `${s.getMonth()+1}/${s.getDate()}–${e.getMonth()+1}/${e.getDate()}`;
                return <span key={i} style={{ fontSize: Math.round(19 * scale), fontWeight: 600, color: '#8A9DA8', background: '#e8eef1', borderRadius: 5, padding: '2px 7px' }}>{label}</span>;
              })}
            </div>
            <button onClick={() => onChangeRef.current([])} style={{ flexShrink: 0, fontSize: Math.round(22 * scale), fontWeight: 600, color: '#E57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>
          </div>
        )}
      </div>
      <div style={fillHeight ? {
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', padding: '12px 10px 8px',
      } : {
        padding: large ? '20px 28px 24px' : '20px 10px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fillHeight ? 6 : 12, flexShrink: 0 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8A9DA8' }}><IcChevron dir="left" size={18} /></button>
          <span style={{ fontSize: fillHeight ? 16 : (large ? 31 : Math.round(31 * scale)), fontWeight: 700, color: '#8A9DA8' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#8A9DA8' }}><IcChevron dir="right" size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', columnGap: large ? 6 : 2, marginBottom: fillHeight ? 2 : 4, flexShrink: 0 }}>
          {DAY_LABELS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: fillHeight ? 12 : (large ? 22 : Math.round(22 * scale)), fontWeight: 600, color: '#91AEC4', padding: '2px 0' }}>{d}</div>)}
        </div>
        <div ref={calRef} style={fillHeight ? {
          display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'auto',
          userSelect: 'none', columnGap: 2,
        } : {
          display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', userSelect: 'none', rowGap: large ? 10 : 4, columnGap: large ? 6 : 2,
        }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dt = new Date(viewYear, viewMonth, d);
            const key = mkKey(dt);
            const disabled = dt < today;
            const selected = displaySet.has(key);
            const isToday  = sameDay(dt, today);
            const dow = (d - 1 + firstDow) % 7;
            const isFirstInRow = dow === 0;
            const isLastInRow  = dow === 6;
            const prevSel = selected && displaySet.has(mkKey(new Date(viewYear, viewMonth, d - 1)));
            const nextSel = selected && displaySet.has(mkKey(new Date(viewYear, viewMonth, d + 1)));
            const bandExt = large ? '-3px' : '-1px';
            const bandL = (!prevSel || isFirstInRow) ? '50%' : bandExt;
            const bandR = (!nextSel || isLastInRow)  ? '50%' : bandExt;
            return (
              <div key={d} data-dkey={disabled ? undefined : key}
                onMouseDown={() => !disabled && mouseDown(key)}
                onMouseEnter={() => !disabled && mouseEnter(key)}
                style={fillHeight ? {
                  aspectRatio: '1 / 1', cursor: disabled ? 'default' : 'pointer', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                } : {
                  height: large ? 82 : 36, cursor: disabled ? 'default' : 'pointer', position: 'relative',
                }}>
                {selected && <div style={{
                  position: 'absolute', left: bandL, right: bandR,
                  top: fillHeight ? '50%' : 2,
                  height: fillHeight ? 34 : (large ? 65 : 32),
                  transform: fillHeight ? 'translateY(-50%)' : undefined,
                  background: 'rgba(138, 157, 168, 0.18)', pointerEvents: 'none',
                }} />}
                <div style={{
                  width: fillHeight ? 'min(36px, 80%)' : (large ? 65 : 32),
                  height: fillHeight ? 'min(36px, 80%)' : (large ? 65 : 32),
                  borderRadius: fillHeight ? '50%' : (large ? 33 : 16),
                  margin: fillHeight ? 0 : '2px auto 0',
                  position: 'relative', zIndex: 1, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? '#8A9DA8' : 'transparent',
                  border: isToday && !selected ? '1.5px solid #8A9DA8' : 'none',
                  fontSize: fillHeight ? 15 : (large ? 31 : Math.round(16 * scale)),
                  fontWeight: selected ? 700 : 400,
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

export default function Home() {
  const navigate = useNavigate();
  const isDesktop = useDesktop();

  // ── Mixpanel: 頁面瀏覽 ──
  useEffect(() => {
    mixpanel.track('頁面瀏覽', { 頁面: '首頁' });
  }, []);

  const dateSelectedRef = useRef(false);
  const timeSetRef = useRef(false);
  const bothTrackedRef = useRef(false);
  const checkAndTrackBoth = () => {
    if (dateSelectedRef.current && timeSetRef.current && !bothTrackedRef.current) {
      bothTrackedRef.current = true;
      mixpanel.track('選取日期和調查時段');
    }
  };

  const [recentEvents, setRecentEvents] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('meetime_recent') || '[]');
      return Array.isArray(raw) ? raw.filter(e => e && typeof e === 'object' && typeof e.name === 'string' && e.name.length > 0) : [];
    } catch { return []; }
  });

  const handleClearHistory = () => {
    if (!window.confirm('確定要清除全部紀錄嗎？')) return;
    mixpanel.track('清除紀錄');
    localStorage.removeItem('meetime_recent');
    setRecentEvents([]);
  };

  const [selectedDates, setSelectedDates] = useState([]);
  const [startSlot, setStartSlot] = useState(18);
  const [endSlot, setEndSlot] = useState(36);
  const [allDay, setAllDay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [meetingName, setMeetingName] = useState('');
  const [nameModalPhase, setNameModalPhase] = useState('input');
  const [generatedId, setGeneratedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [totalCount, setTotalCount] = useState(null);
  useEffect(() => {
    supabase.from('meetings').select('*', { count: 'exact', head: true })
      .then(({ count }) => setTotalCount(count ?? 0));
  }, []);
  const [linkCopied, setLinkCopied] = useState(false);

  const openNameModal = () => {
    let hasError = false;
    if (selectedDates.length === 0) { setDateError('請選取日期'); hasError = true; } else setDateError('');
    if (!allDay && startSlot >= endSlot) { setTimeError('請選取調查時段'); hasError = true; } else setTimeError('');
    if (hasError) return;
    setMeetingName('');
    setNameModalPhase('input');
    setGeneratedId(null);
    setSaveError('');
    setLinkCopied(false);
    setShowNameModal(true);
  };

  const handleConfirmName = async () => {
    if (!meetingName.trim() || saving) return;
    mixpanel.track('輸入活動名稱');
    const id = Math.random().toString(36).slice(2, 10);
    const rs = selectedDates[0] ?? null;
    const re = selectedDates[selectedDates.length - 1] ?? null;
    const payload = {
      id,
      name:        meetingName.trim(),
      range_start: rs?.getTime() ?? null,
      range_end:   re?.getTime() ?? null,
      date_list:   selectedDates.map(d => d.getTime()),
      start_slot:  startSlot,
      end_slot:    endSlot,
      all_day:     allDay,
      duration,
    };
    setGeneratedId(id);
    setNameModalPhase('link');
    let { error } = await supabase.from('meetings').insert(payload);
    if (error) {
      const { date_list, ...payloadWithout } = payload;
      ({ error } = await supabase.from('meetings').insert(payloadWithout));
    }
    if (error) {
      setSaveError('建立失敗，請再試一次');
      setNameModalPhase('input');
      return;
    }
    try {
      localStorage.setItem(`meetime_event_${id}`, JSON.stringify({
        id,
        name:       meetingName.trim(),
        rangeStart: rs?.getTime() ?? null,
        rangeEnd:   re?.getTime() ?? null,
        dateList:   selectedDates.map(d => d.getTime()),
        startSlot,
        endSlot,
        allDay,
        duration,
      }));
    } catch {}
    try {
      const prev = JSON.parse(localStorage.getItem('meetime_recent') || '[]');
      prev.unshift({ id, name: meetingName.trim(), time: Date.now() });
      localStorage.setItem('meetime_recent', JSON.stringify(prev.slice(0, 10)));
      setRecentEvents(prev.slice(0, 10));
    } catch {}
  };

  const shareUrl = `${window.location.origin}/join/${generatedId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      mixpanel.track('邀請連結複製');
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  };

  const recentEventsBlock = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#8A9DA8' }}>最近活動</span>
        {recentEvents.length > 0 && (
          <button onClick={handleClearHistory} style={{ fontSize: 14, color: '#BBB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除紀錄</button>
        )}
      </div>
      {recentEvents.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#CCC', fontSize: 16, padding: '20px 0' }}>尚無建立紀錄</div>
      ) : (
        <>
          {(isDesktop || showAllRecent ? recentEvents : recentEvents.slice(0, 2)).map((ev, i) => {
            const daysAgo = Math.floor((Date.now() - ev.time) / 86400000);
            const timeLabel = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo} 天前`;
            const color = DOT_COLORS[i % DOT_COLORS.length];
            return (
              <div key={ev.id} onClick={() => {
                mixpanel.track('點擊最近活動');
                navigate(`/view/${ev.id}`);
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                </div>
                <div style={{ fontSize: 14, color: '#CCC', flexShrink: 0 }}>{timeLabel}</div>
              </div>
            );
          })}
          {!isDesktop && recentEvents.length > 2 && (
            <button onClick={() => setShowAllRecent(v => !v)} style={{ width: '100%', background: 'none', border: 'none', color: '#AAA', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0 2px', textAlign: 'center' }}>
              {showAllRecent ? '收起' : `顯示其他 ${recentEvents.length - 2} 筆`}
            </button>
          )}
        </>
      )}
    </>
  );

  const formBlock = (
    <>
      <div className="form-field">
        <label className="form-label" style={{ fontSize: 16 }}>選取日期 <span style={{ color: '#E53935' }}>*</span></label>
        <DateMultiPicker scale={0.8} selectedDates={selectedDates} onChange={(v) => {
          setSelectedDates(v);
          if (v.length > 0) { setDateError(''); dateSelectedRef.current = true; checkAndTrackBoth(); }
        }} />
        {dateError && <div style={{ fontSize: 11, color: '#E53935', marginTop: 6 }}>{dateError}</div>}
      </div>
      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className="form-label" style={{ marginBottom: 0, fontSize: 16 }}>選取調查時段 <span style={{ color: '#E53935' }}>*</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#888' }}>全天</span>
            <div onClick={() => {
              const next = !allDay;
              setAllDay(next);
              setTimeError('');
              mixpanel.track('全天切換', { 切換為: next ? '全天' : '自訂時段' });
              timeSetRef.current = true; checkAndTrackBoth();
            }} style={{ width: 40, height: 24, borderRadius: 12, background: allDay ? '#8A9DA8' : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: allDay ? 18 : 2, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
        <div style={{ opacity: allDay ? 0.45 : 1, pointerEvents: allDay ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <TimeRangeSlider scale={0.8} startSlot={allDay ? 0 : startSlot} endSlot={allDay ? SLIDER_TOTAL : endSlot} onChange={(s, e) => { setStartSlot(s); setEndSlot(e); setTimeError(''); }} onChangeEnd={() => { timeSetRef.current = true; checkAndTrackBoth(); }} />
        </div>
        {timeError && <div style={{ fontSize: 11, color: '#E53935', marginTop: 6 }}>{timeError}</div>}
      </div>
      <div className="form-field">
        <label className="form-label" style={{ fontSize: 16 }}>預計活動時長（選填）</label>
        <DurationSlider scale={0.8} value={duration} onChange={setDuration} onChangeEnd={(v) => mixpanel.track('設定活動時長', { 有設定時長: v > 0 })} />
      </div>
    </>
  );

  const modalContent = (
    <>
      {nameModalPhase === 'input' ? (<>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 20 }}>活動名稱</div>
        <input autoFocus className="form-input" value={meetingName} onChange={e => setMeetingName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleConfirmName(); }} style={{ marginBottom: 20, fontSize: 20 }} />
        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
          {[
            { label: '調查日期', value: selectedDates.length === 0 ? '未設定' : selectedDates.length === 1 ? `${SHORT_MONTHS[selectedDates[0].getMonth()]} ${selectedDates[0].getDate()}` : selectedDates.length <= 3 ? selectedDates.map(d => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`).join('、') : `${SHORT_MONTHS[selectedDates[0].getMonth()]} ${selectedDates[0].getDate()} – ${SHORT_MONTHS[selectedDates[selectedDates.length-1].getMonth()]} ${selectedDates[selectedDates.length-1].getDate()} (${selectedDates.length}天)` },
            { label: '調查時段', value: allDay ? '全天' : `${fmtSlot(startSlot)} ${fmtPeriod(startSlot)} – ${fmtSlot(endSlot)} ${fmtPeriod(endSlot)}` },
            { label: '活動時長', value: fmtDuration(duration) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
              <span style={{ fontSize: 18, color: '#AAA' }}>{label}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#555' }}>{value}</span>
            </div>
          ))}
        </div>
        {saveError && <div style={{ fontSize: 17, color: '#E53935', marginBottom: 14 }}>{saveError}</div>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowNameModal(false)} style={{ flex: 1, padding: '16px', borderRadius: 14, border: 'none', background: '#F0F0F0', color: '#555', fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
          <button onClick={handleConfirmName} disabled={!meetingName.trim() || saving} style={{ flex: 2, padding: '16px', borderRadius: 14, border: 'none', background: meetingName.trim() && !saving ? '#8A9DA8' : '#D0D8DC', color: '#fff', fontSize: 20, fontWeight: 700, cursor: meetingName.trim() && !saving ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'background 0.2s' }}>
            {saving ? '建立中…' : '確認'}
          </button>
        </div>
      </>) : (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: '#E8EEF1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#8A9DA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>邀請連結已建立</div>
        </div>
        <div style={{ background: '#E8EEF1', borderRadius: 14, padding: '14px 12px 14px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, fontSize: 17, color: '#5F84A2', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shareUrl}
          </div>
          <button onClick={handleCopyLink} style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 10, border: 'none', background: linkCopied ? '#8A9DA8' : '#7A8C9C', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap' }}>
            {linkCopied ? '已複製 ✓' : '複製'}
          </button>
        </div>
        <button onClick={() => {
          mixpanel.track('分享至LINE');
          const lineMsg = `${meetingName.trim()} 邀請你填寫可用時間！\n\n點擊以下連結填寫：\n${shareUrl}`;
          window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lineMsg)}`, '_blank');
        }} style={{ width: '100%', padding: '18px', borderRadius: 14, border: 'none', background: '#8FA99A', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          傳送至 LINE
        </button>
        <button onClick={() => { mixpanel.track('填寫我的時間'); setShowNameModal(false); navigate('/grid', { state: { meetingId: generatedId, eventName: meetingName.trim(), rangeStart: selectedDates[0]?.getTime() ?? null, rangeEnd: selectedDates[selectedDates.length-1]?.getTime() ?? null, dateList: selectedDates.map(d => d.getTime()), startSlot, endSlot, allDay, duration } }); }}
          style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1.5px solid #8A9DA8', background: 'transparent', color: '#8A9DA8', fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          填寫我的時間
        </button>
      </>)}
    </>
  );

  return (
    <div className="app-container" style={isDesktop ? { overflowX: 'hidden' } : { background: '#fff' }}>
      {isDesktop ? (
        <>
          {/* Navbar */}
          <div style={{ height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 60px', borderBottom: '1px solid #F0F0F0' }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: '#8A9DA8', letterSpacing: '-0.04em' }}>meetime</span>
          </div>
          {/* Two-column layout */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 40, padding: '24px 60px', overflow: 'hidden', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {/* Left column 60% */}
            <div style={{ flex: 55, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* Recent events */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#8A9DA8' }}>最近活動</span>
                  {recentEvents.length > 0 && (
                    <button onClick={handleClearHistory} style={{ fontSize: 15, color: '#BBB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除紀錄</button>
                  )}
                </div>
                {recentEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#CCC', fontSize: 17, padding: '16px 0' }}>尚無建立紀錄</div>
                ) : (
                  <>
                    {(showAllRecent ? recentEvents : recentEvents.slice(0, 3)).map((ev, i) => {
                      const daysAgo = Math.floor((Date.now() - ev.time) / 86400000);
                      const timeLabel = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo} 天前`;
                      const color = DOT_COLORS[i % DOT_COLORS.length];
                      return (
                        <div key={ev.id} onClick={() => { mixpanel.track('點擊最近活動'); navigate(`/view/${ev.id}`); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1.5px solid #F0F0F0', marginBottom: 10, cursor: 'pointer' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                          </div>
                          <div style={{ fontSize: 15, color: '#CCC', flexShrink: 0, marginLeft: 8 }}>{timeLabel}</div>
                        </div>
                      );
                    })}
                    {recentEvents.length > 3 && (
                      <button onClick={() => setShowAllRecent(v => !v)} style={{ width: '100%', background: 'none', border: 'none', color: '#AAA', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', textAlign: 'center' }}>
                        {showAllRecent ? '收起' : '顯示更多'}
                      </button>
                    )}
                  </>
                )}
              </div>
              {/* Divider */}
              <div style={{ height: 1, background: '#F0F0F0', margin: '16px 0', flexShrink: 0 }} />
              {/* Calendar fills remaining height */}
              {dateError && <div style={{ fontSize: 13, color: '#E53935', marginBottom: 4, flexShrink: 0 }}>{dateError}</div>}
              <div style={{ flex: 1, minHeight: 0 }}>
                <DateMultiPicker
                  fillHeight
                  selectedDates={selectedDates}
                  onChange={(v) => {
                    setSelectedDates(v);
                    if (v.length > 0) { setDateError(''); dateSelectedRef.current = true; checkAndTrackBoth(); }
                  }}
                />
              </div>
            </div>

            {/* Right column 40% */}
            <div style={{ flex: 45, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, overflow: 'visible', padding: '0 24px' }}>
              {/* Top: time range */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 18, fontWeight: 700, color: '#555' }}>
                    選取調查時段 <span style={{ color: '#E53935' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#888' }}>全天</span>
                    <div onClick={() => {
                      const next = !allDay;
                      setAllDay(next);
                      setTimeError('');
                      mixpanel.track('全天切換', { 切換為: next ? '全天' : '自訂時段' });
                      timeSetRef.current = true; checkAndTrackBoth();
                    }} style={{ width: 44, height: 26, borderRadius: 13, background: allDay ? '#8A9DA8' : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: allDay ? 20 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                </div>
                <div style={{ opacity: allDay ? 0.45 : 1, pointerEvents: allDay ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                  <TimeRangeSlider startSlot={allDay ? 0 : startSlot} endSlot={allDay ? SLIDER_TOTAL : endSlot} onChange={(s, e) => { setStartSlot(s); setEndSlot(e); setTimeError(''); }} onChangeEnd={() => { timeSetRef.current = true; checkAndTrackBoth(); }} />
                </div>
                {timeError && <div style={{ fontSize: 13, color: '#E53935', marginTop: 6 }}>{timeError}</div>}
              </div>

              {/* Middle: duration */}
              <div>
                <label style={{ fontSize: 18, fontWeight: 700, color: '#555', display: 'block', marginBottom: 10 }}>預計活動時長（選填）</label>
                <DurationSlider value={duration} onChange={setDuration} onChangeEnd={(v) => mixpanel.track('設定活動時長', { 有設定時長: v > 0 })} />
              </div>

              {/* Bottom: submit button */}
              <div>
                <button className="btn-primary" onClick={openNameModal} style={{ fontSize: 22 }}>
                  建立活動
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#6d7b86', letterSpacing: '-0.04em' }}>meetime</span>
          </div>
          <div className="screen-content">
            <div style={{ padding: '16px 16px 0' }}>{recentEventsBlock}</div>
            <div style={{ padding: '16px 16px 0' }}>{formBlock}</div>
            <div style={{ padding: '4px 16px 40px' }}>
              <button className="btn-primary" onClick={openNameModal}>
                送出
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
      {showNameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={() => nameModalPhase === 'input' && setShowNameModal(false)}>
          <div style={{ width: '100%', maxWidth: isDesktop ? 600 : 340, background: '#fff', borderRadius: 24, padding: isDesktop ? '44px 40px 36px' : '24px 20px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            {modalContent}
          </div>
        </div>
      )}
    </div>
  );
}
