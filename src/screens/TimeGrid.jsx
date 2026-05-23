import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 28;
const LABEL_W = 48;
const SCROLL_W = 24;
const DAYS_PER_PAGE = 4;
const FREE_COLOR = '#8A9DA8';
const SLOT_COLOR = 'rgba(47,65,86,0.28)';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtH = h => {
  const hr = Math.floor(h), min = Math.round((h - hr) * 60);
  const period = hr < 12 ? 'am' : 'pm';
  const dh = (hr === 0 || hr === 12) ? 12 : hr % 12;
  return min === 0 ? `${dh}${period}` : `${dh}:${String(min).padStart(2, '0')}${period}`;
};

function buildAllDays(rangeStartTs, rangeEndTs, dateList) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Use explicit date list if provided (new meetings with individual date selection)
  if (dateList && dateList.length > 0) {
    const sorted = [...dateList].map(ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d; }).sort((a,b) => a-b);
    let todayIdx = -1;
    const days = sorted.map((d, i) => {
      if (d.getTime() === today.getTime()) todayIdx = i;
      return { label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() };
    });
    return { days, todayIdx };
  }
  // Fall back to range for older meetings
  if (!rangeStartTs) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() });
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
    days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() });
  }
  return { days, todayIdx };
}

function pageNavLabel(pageDays) {
  if (!pageDays.length) return '';
  const first = pageDays[0];
  const last  = pageDays[pageDays.length - 1];
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

// 4 anchor colors: lightest → darkest
const HEAT_ANCHORS = [[191,204,212],[159,181,195],[138,157,168],[47,65,86]];
function heatColor(n, total) {
  if (n === 0 || total === 0) return 'transparent';
  const t = total === 1 ? 1 : (n - 1) / (total - 1);
  const scaled = t * (HEAT_ANCHORS.length - 1);
  const lo = Math.min(Math.floor(scaled), HEAT_ANCHORS.length - 2);
  const f  = scaled - lo;
  const hi = lo + 1;
  const [r0,g0,b0] = HEAT_ANCHORS[lo], [r1,g1,b1] = HEAT_ANCHORS[hi];
  return `rgb(${Math.round(r0+f*(r1-r0))},${Math.round(g0+f*(g1-g0))},${Math.round(b0+f*(b1-b0))})`;
}

export default function TimeGrid() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const { days: allDays, todayIdx } = buildAllDays(state?.rangeStart, state?.rangeEnd, state?.dateList);
  const totalDays  = allDays.length;
  const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

  const G_START = state?.allDay ? 0  : Math.floor((state?.startSlot ?? 16) / 2);
  const G_END   = state?.allDay ? 24 : Math.ceil((state?.endSlot   ?? 36) / 2);
  const TOTAL   = (G_END - G_START) * SPH;

  const [tab,  setTab]  = useState('mine'); // 'mine' | 'group'
  const [page, setPage] = useState(0);
  const [slots, setSlots] = useState(() => initSlots(totalDays, TOTAL));
  const [showNameModal, setShowNameModal] = useState(false);
  const [name, setName] = useState(state?.myName ?? '');
  const [hoveredCell, setHoveredCell] = useState(null); // { day, slot, cx, cy }
  const [selectedRespondents, setSelectedRespondents] = useState(() => new Set([0]));
  const [groupResponses, setGroupResponses] = useState([]);
  const [groupNames, setGroupNames] = useState([]);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const pageRef  = useRef(page);
  const slotsRef = useRef(slots);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { slotsRef.current = { ...slots }; }, [slots]);

  const dragRef         = useRef({ active: false, target: 0, lastKey: null });
  const gestureRef      = useRef({ phase: 'idle', startX: 0, startY: 0, startDay: null, startSlot: null });
  const scrollContainerRef  = useRef(null);

  useEffect(() => {
    if (!state?.meetingId) return;
    supabase.from('responses').select('respondent_name,slots').eq('meeting_id', state.meetingId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setGroupNames(data.map(r => r.respondent_name));
          setGroupResponses(data.map(r => r.slots));
        }
      });
  }, [state?.meetingId]);

  useEffect(() => {
    setSelectedRespondents(prev => {
      const next = new Set(prev);
      groupResponses.forEach((_, i) => next.add(i + 1));
      return next;
    });
  }, [groupResponses.length]);

  const allRespondents  = [slots, ...groupResponses];
  const respondentCount = allRespondents.length;
  const visibleRespondents = allRespondents.filter((_, i) => selectedRespondents.has(i));
  const visibleCount = visibleRespondents.length;

  const toggleRespondent = (i) => {
    setSelectedRespondents(prev => {
      const next = new Set(prev);
      if (next.has(i)) { if (next.size > 1) next.delete(i); }
      else next.add(i);
      return next;
    });
  };

  // ── Paint logic ───────────────────────────────────────────────────────────────
  const paintSlot = (key, val) => {
    slotsRef.current[key] = val;
    const [d, s] = key.split('-');
    const el = document.getElementById(`sl-${d}-${s}`);
    if (el) el.style.background = val === 1 ? SLOT_COLOR : 'transparent';
  };
  const flushSlots = () => setSlots({ ...slotsRef.current });

  const startDrag = (dayIdx, slot) => {
    const key = `${dayIdx}-${slot}`;
    const target = slotsRef.current[key] === 0 ? 1 : 0;
    dragRef.current = { active: true, target, lastKey: key };
    paintSlot(key, target);
  };
  const moveDrag = (dayIdx, slot) => {
    if (!dragRef.current.active) return;
    const key = `${dayIdx}-${slot}`;
    if (key === dragRef.current.lastKey) return;
    dragRef.current.lastKey = key;
    paintSlot(key, dragRef.current.target);
  };

  // Non-passive touchmove — block scroll while gesture is pending/swipe/paint
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onMove = (e) => {
      const g = gestureRef.current;
      if (g.phase === 'idle' || g.phase === 'scroll') return;
      const t = e.touches[0];
      if (g.phase === 'pending') {
        const dx = Math.abs(t.clientX - g.startX);
        const dy = Math.abs(t.clientY - g.startY);
        // Block scroll during direction-detection window so browser can't start scrolling early
        if (dx < 6 && dy < 6) { e.preventDefault(); return; }
        if (dx > dy) { g.phase = 'swipe'; }
        else if (g.startDay !== null) {
          g.phase = 'paint';
          g.lastTX = t.clientX; g.lastTY = t.clientY;
          startDrag(g.startDay, g.startSlot);
        }
        else { g.phase = 'scroll'; return; } // vertical scroll on non-cell area — allow native scroll
      }
      // swipe or paint: always block page scroll
      e.preventDefault();
      if (g.phase === 'paint') {
        const lx = g.lastTX ?? t.clientX;
        const ly = g.lastTY ?? t.clientY;
        const cx = t.clientX, cy = t.clientY;
        const dist = Math.sqrt((cx - lx) ** 2 + (cy - ly) ** 2);
        const steps = Math.max(1, Math.ceil(dist / (SLOT_H * 0.5)));
        for (let i = 1; i <= steps; i++) {
          const px = lx + (cx - lx) * (i / steps);
          const py = ly + (cy - ly) * (i / steps);
          const el = document.elementFromPoint(px, py);
          if (el?.dataset.slot !== undefined && el?.dataset.day !== undefined)
            moveDrag(+el.dataset.day, +el.dataset.slot);
        }
        g.lastTX = cx; g.lastTY = cy;
      }
    };
    container.addEventListener('touchmove', onMove, { passive: false });
    return () => container.removeEventListener('touchmove', onMove);
  }, [tab]);

  const handleContainerTouchStart = (e) => {
    const t = e.touches[0];
    const el = e.target;
    const startDay  = el?.dataset?.day  !== undefined ? +el.dataset.day  : null;
    const startSlot = el?.dataset?.slot !== undefined ? +el.dataset.slot : null;
    gestureRef.current = { phase: 'pending', startX: t.clientX, startY: t.clientY, startDay, startSlot };
  };
  const handleContainerTouchEnd = (e) => {
    const g = gestureRef.current;
    if (g.phase === 'pending' && g.startDay !== null) { startDrag(g.startDay, g.startSlot); flushSlots(); }
    else if (g.phase === 'paint') { flushSlots(); }
    else if (g.phase === 'swipe') {
      const dx  = e.changedTouches[0].clientX - g.startX;
      const cur = pageRef.current;
      if (dx < -50 && cur < totalPages - 1) setPage(cur + 1);
      if (dx >  50 && cur > 0)             setPage(cur - 1);
    }
    g.phase = 'idle';
    dragRef.current.active = false;
  };

  const handleMouseDown  = (d, s) => startDrag(d, s);
  const handleMouseEnter = (d, s) => moveDrag(d, s);
  const handleMouseUp    = () => { dragRef.current.active = false; flushSlots(); };

  const fillDay = (dayIdx) => {
    const allFilled = Array.from({ length: TOTAL }, (_, s) => slotsRef.current[`${dayIdx}-${s}`] === 1).every(Boolean);
    const target = allFilled ? 0 : 1;
    const newSlots = { ...slotsRef.current };
    for (let s = 0; s < TOTAL; s++) {
      const key = `${dayIdx}-${s}`;
      newSlots[key] = target;
      const el = document.getElementById(`sl-${dayIdx}-${s}`);
      if (el) el.style.background = target === 1 ? SLOT_COLOR : 'transparent';
    }
    slotsRef.current = newSlots;
    setSlots(newSlots);
  };

  const autofillBestTime = () => {
    let maxCount = 0;
    for (let d = 0; d < totalDays; d++)
      for (let s = 0; s < TOTAL; s++) {
        const count = groupResponses.filter(r => r[`${d}-${s}`] === 1).length;
        if (count > maxCount) maxCount = count;
      }
    if (maxCount === 0) return;
    const newSlots = { ...slotsRef.current };
    for (let d = 0; d < totalDays; d++)
      for (let s = 0; s < TOTAL; s++) {
        const key = `${d}-${s}`;
        if (groupResponses.filter(r => r[key] === 1).length >= maxCount) {
          newSlots[key] = 1;
          const el = document.getElementById(`sl-${d}-${s}`);
          if (el) el.style.background = SLOT_COLOR;
        }
      }
    slotsRef.current = newSlots;
    setSlots(newSlots);
  };

  const submitResponse = async () => {
    if (!name.trim()) return;
    setSubmittingResponse(true);
    if (state?.meetingId) {
      await supabase.from('responses').insert({
        meeting_id: state.meetingId,
        respondent_name: name.trim(),
        slots: slotsRef.current,
      });
    }
    setSubmittingResponse(false);
    navigate('/results', {
      state: {
        meetingId:  state?.meetingId,
        myName:     name.trim(),
        duration:   state?.duration,
        rangeStart: state?.rangeStart,
        rangeEnd:   state?.rangeEnd,
        dateList:   state?.dateList,
        startSlot:  state?.startSlot,
        endSlot:    state?.endSlot,
        allDay:     state?.allDay,
      }
    });
  };

  const showGroupCell = (e, day, slot) => {
    e.stopPropagation();
    setHoveredCell({ day, slot, cx: e.clientX, cy: e.clientY });
  };

  const pageStart = page * DAYS_PER_PAGE;
  const pageDays  = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);

  const surveyLabel = useMemo(() => {
    if (!state?.rangeStart) return '';
    const start = new Date(state.rangeStart);
    const end   = state.rangeEnd ? new Date(state.rangeEnd) : start;
    const sm = start.getMonth(), em = end.getMonth();
    return sm === em
      ? `${MON[sm]} ${start.getDate()}–${end.getDate()}`
      : `${MON[sm]} ${start.getDate()} – ${MON[em]} ${end.getDate()}`;
  }, [state]);

  // ── Shared day-header + grid skeleton ────────────────────────────────────────
  const DayHeader = ({ onDayClick } = {}) => (
    <div style={{ display: 'flex', position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
      <div style={{ width: LABEL_W, flexShrink: 0 }} />
      {pageDays.map((d, i) => {
        const isToday = (pageStart + i) === todayIdx;
        const globalIdx = pageStart + i;
        return (
          <div key={i} onClick={() => onDayClick?.(globalIdx)}
            style={{ flex: 1, textAlign: 'center', padding: '5px 0 6px', cursor: onDayClick ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? '#8A9DA8' : '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.label}</div>
            <div style={{ width: 22, height: 22, borderRadius: 11, margin: '2px auto 0', background: isToday ? '#8A9DA8' : 'transparent', color: isToday ? '#fff' : '#8A9DA8', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.date}</div>
          </div>
        );
      })}
      <div style={{ width: SCROLL_W, flexShrink: 0 }} />
    </div>
  );

  return (
    <div className="app-container">
      <div className="app-nav">
        <span style={{ fontSize: 16, color: '#888', fontWeight: 500 }}>{surveyLabel}</span>
        <span className="nav-title">填寫我的時間</span>
        <span style={{ width: 48 }} />
      </div>

      {/* Tab switcher */}
      <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: '#F0F0F0', borderRadius: 10, padding: 3 }}>
          {[['mine', '我的'], ['group', '群組']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', fontFamily: 'inherit',
              fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s',
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? FREE_COLOR : '#AAA',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', flexShrink: 0, padding: '0 4px' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} style={{
            background: 'none', border: 'none', fontSize: 28, fontFamily: 'inherit',
            color: page > 0 ? FREE_COLOR : '#DDD', padding: '8px 12px', minWidth: 44,
            cursor: page > 0 ? 'pointer' : 'default',
          }}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#888' }}>
            {pageNavLabel(pageDays)}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{
            background: 'none', border: 'none', fontSize: 28, fontFamily: 'inherit',
            color: page < totalPages - 1 ? FREE_COLOR : '#DDD', padding: '8px 12px', minWidth: 44,
            cursor: page < totalPages - 1 ? 'pointer' : 'default',
          }}>›</button>
        </div>
      )}

      {/* ── Mine tab ─────────────────────────────────────────────────────────── */}
      {tab === 'mine' && (
        <div
          ref={scrollContainerRef}
          style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleContainerTouchStart}
          onTouchEnd={handleContainerTouchEnd}
        >
          {DayHeader({ onDayClick: fillDay })}
          <div style={{ display: 'flex', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }}>
              {Array.from({ length: TOTAL }, (_, s) => (
                <div key={s} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 2, borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px dashed #F0F0F0' }}>
                  {s % SPH === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#BBB' }}>{fmtH(G_START + s / SPH)}</span>}
                </div>
              ))}
            </div>
            {pageDays.map((_, i) => {
              const globalIdx = pageStart + i;
              return (
                <div key={globalIdx} style={{ flex: 1, borderLeft: i > 0 ? '1px solid #EBEBEB' : 'none' }}>
                  {Array.from({ length: TOTAL }, (_, slot) => {
                    const key  = `${globalIdx}-${slot}`;
                    const free = slots[key] === 1;
                    return (
                      <div key={slot}
                        id={`sl-${globalIdx}-${slot}`}
                        data-day={globalIdx} data-slot={slot}
                        onMouseDown={() => handleMouseDown(globalIdx, slot)}
                        onMouseEnter={() => handleMouseEnter(globalIdx, slot)}
                        style={{ height: SLOT_H, background: free ? SLOT_COLOR : 'transparent', borderTop: slot % SPH === 0 ? '1px solid #EBEBEB' : '1px dashed #F0F0F0', cursor: 'pointer' }}
                      />
                    );
                  })}
                </div>
              );
            })}
            <div style={{ width: SCROLL_W, flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* ── Group tab ────────────────────────────────────────────────────────── */}
      {tab === 'group' && (
        <div
          style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          onClick={() => setHoveredCell(null)}
          onScroll={() => setHoveredCell(null)}
        >
          {DayHeader({})}
          <div style={{ display: 'flex', userSelect: 'none' }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }}>
              {Array.from({ length: TOTAL }, (_, s) => (
                <div key={s} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 2, borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent' }}>
                  {s % SPH === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#BBB' }}>{fmtH(G_START + s / SPH)}</span>}
                </div>
              ))}
            </div>
            {pageDays.map((_, i) => {
              const globalIdx = pageStart + i;
              return (
                <div key={globalIdx} style={{ flex: 1, borderLeft: i > 0 ? '1px solid #EBEBEB' : 'none' }}>
                  {Array.from({ length: TOTAL }, (_, slot) => {
                    const key   = `${globalIdx}-${slot}`;
                    const count = visibleRespondents.filter(r => r[key] === 1).length;
                    return (
                      <div key={slot} data-day={globalIdx} data-slot={slot}
                        onClick={e => showGroupCell(e, globalIdx, slot)}
                        style={{ height: SLOT_H, background: heatColor(count, visibleCount), borderTop: slot % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent', cursor: 'pointer' }} />
                    );
                  })}
                </div>
              );
            })}
            <div style={{ width: SCROLL_W, flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Bottom */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        {tab === 'mine' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={autofillBestTime} style={{
                flex: 1, padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${FREE_COLOR}`,
                background: 'transparent', color: FREE_COLOR, fontSize: 15, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>填入目前最佳時段</button>
              <button className="btn-primary" onClick={() => setShowNameModal(true)} style={{ flex: 1, padding: '12px' }}>
                送出
              </button>
            </div>

          </>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {allRespondents.map((_, i) => {
              const n = i === 0 ? (name || '你') : (groupNames[i - 1] ?? '?');
              const c = [FREE_COLOR, '#8A9DA8', '#26A69A', '#4DB6AC'][i];
              const sel = selectedRespondents.has(i);
              return (
                <div key={i} onClick={() => toggleRespondent(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  background: sel ? 'rgba(183,208,225,0.3)' : '#F5F5F5',
                  border: `1.5px solid ${sel ? c : '#E5E5E5'}`,
                  borderRadius: 20, padding: '5px 10px', transition: 'all 0.15s',
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: sel ? c : '#CCC', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div>
                  <span style={{ fontSize: 14, fontWeight: sel ? 600 : 400, color: sel ? '#333' : '#AAA' }}>{n}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group cell tooltip */}
      {hoveredCell && tab === 'group' && (() => {
        const key     = `${hoveredCell.day}-${hoveredCell.slot}`;
        const dayInfo = allDays[hoveredCell.day];
        const time    = fmtH(G_START + hoveredCell.slot / SPH);
        const people  = allRespondents.map((r, i) => ({
          name: i === 0 ? (name || '你') : (groupNames[i - 1] ?? '?'),
          free: r[key] === 1,
        }));
        const avail = people.filter(p => p.free);
        const busy  = people.filter(p => !p.free);
        const allFree = avail.length === people.length;

        const TW = 190;
        const left = Math.max(8, Math.min(hoveredCell.cx - TW / 2, window.innerWidth - TW - 8));
        const aboveY = hoveredCell.cy - 160;
        const top  = aboveY < 140 ? hoveredCell.cy + 16 : aboveY;
        return (
          <div key="group-tip" style={{
            position: 'absolute', left, top, width: TW,
            background: '#fff', borderRadius: 14, padding: '12px 14px 14px',
            boxShadow: '0 6px 28px rgba(0,0,0,0.18)', zIndex: 50,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#8A9DA8' }}>
                {allFree ? '所有人都有空' : `${avail.length} / ${people.length} 人有空`}
              </div>
              <button onTouchEnd={e => { e.stopPropagation(); setHoveredCell(null); }}
                onClick={() => setHoveredCell(null)}
                style={{ background: 'none', border: 'none', fontSize: 16, color: '#CCC', cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#AAA', marginBottom: 10 }}>
              {dayInfo?.label} {dayInfo?.date} · {time}
            </div>
            {avail.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: busy.length ? 8 : 0 }}>
                {avail.map(({ name: n }) => (
                  <div key={n} style={{ padding: '4px 10px', borderRadius: 20, background: '#1A1A1A', color: '#fff', fontSize: 14, fontWeight: 600 }}>{n}</div>
                ))}
              </div>
            )}
            {busy.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {busy.map(({ name: n }) => (
                  <div key={n} style={{ padding: '4px 10px', borderRadius: 20, background: '#F0F0F0', color: '#AAA', fontSize: 14 }}>{n}</div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Name modal */}
      {showNameModal && (
        <div onClick={() => setShowNameModal(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '28px 20px 24px', position: 'relative' }}>
            <button onClick={() => setShowNameModal(false)} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 14, border: 'none', background: '#F0F0F0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
              </svg>
            </button>
            <div style={{ fontSize: 23, fontWeight: 700, color: '#8A9DA8', marginBottom: 20 }}>輸入姓名</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && submitResponse()}
              placeholder="輸入你的名字"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 20, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <button className="btn-primary" disabled={!name.trim() || submittingResponse}
              onClick={submitResponse}
              style={{ padding: '13px', opacity: name.trim() && !submittingResponse ? 1 : 0.4 }}>
              {submittingResponse ? '送出中…' : '送出'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
