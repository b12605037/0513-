import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StatusBar from '../components/StatusBar';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 22;
const LABEL_W = 44;
const DAYS_PER_PAGE = 4;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtH = h => {
  const hr = Math.floor(h), min = Math.round((h - hr) * 60);
  const period = hr < 12 ? 'am' : 'pm';
  const dh = (hr === 0 || hr === 12) ? 12 : hr % 12;
  return min === 0 ? `${dh}${period}` : `${dh}:${String(min).padStart(2, '0')}${period}`;
};

function buildAllDays(rangeStartTs, rangeEndTs) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!rangeStartTs) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() });
    }
    return days;
  }
  const start = new Date(rangeStartTs); start.setHours(0, 0, 0, 0);
  const end = rangeEndTs ? new Date(rangeEndTs) : new Date(start); end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() });
  }
  return days;
}

function pageNavLabel(pageDays) {
  if (!pageDays.length) return '';
  const first = pageDays[0];
  const last  = pageDays[pageDays.length - 1];
  return first.month === last.month
    ? `${MON[first.month]} ${first.date}–${last.date}`
    : `${MON[first.month]} ${first.date} – ${MON[last.month]} ${last.date}`;
}

// Deterministic "fake" respondents based on slot key hash
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function makeMockSlots(totalDays, total, seed) {
  const rand = seededRand(seed);
  const g = {};
  for (let d = 0; d < totalDays; d++)
    for (let s = 0; s < total; s++)
      g[`${d}-${s}`] = rand() > 0.45 ? 1 : 0;
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

const MOCK_NAMES = ['Alex', 'Sam', 'Jamie'];

export default function Results() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const G_START = state?.allDay ? 0  : Math.floor((state?.startSlot ?? 16) / 2);
  const G_END   = state?.allDay ? 24 : Math.ceil((state?.endSlot   ?? 36) / 2);
  const TOTAL   = (G_END - G_START) * SPH;

  const allDays    = useMemo(() => buildAllDays(state?.rangeStart, state?.rangeEnd), [state]);
  const totalDays  = allDays.length;
  const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

  const mySlots = state?.mySlots ?? {};
  const myName  = state?.myName  ?? '你';

  // Generate 3 deterministic mock respondents
  const mockSlots = useMemo(() => MOCK_NAMES.map((_, i) =>
    makeMockSlots(totalDays, TOTAL, 42 + i * 17)
  ), [totalDays, TOTAL]);

  const allRespondents  = [mySlots, ...mockSlots];
  const respondentNames = [myName, ...MOCK_NAMES];
  const COLORS = ['#194569', '#5F84A2', '#91AEC4', '#2F4156'];

  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set(allRespondents.map((_, i) => i)));

  const pageStart = page * DAYS_PER_PAGE;
  const pageDays  = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);

  const toggleRespondent = (i) =>
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const visibleRespondents = allRespondents.filter((_, i) => selected.has(i));
  const visibleCount = visibleRespondents.length;

  const slotsNeeded = Math.max(1, Math.ceil((state?.duration ?? 30) / SLOT_MIN));

  const visibleWithIdx = allRespondents.map((r, i) => ({ r, i })).filter(({ i }) => selected.has(i));

  const bestSlot = useMemo(() => {
    if (visibleCount === 0) return null;
    let best = null, bestScore = -1;
    for (let d = 0; d < totalDays; d++) {
      for (let s = 0; s < TOTAL; s++) {
        const freeSet = new Set(visibleWithIdx.map((_, vi) => vi));
        for (let len = 1; len <= slotsNeeded && s + len <= TOTAL; len++) {
          const slotKey = `${d}-${s + len - 1}`;
          for (const vi of [...freeSet])
            if (visibleWithIdx[vi].r[slotKey] !== 1) freeSet.delete(vi);
          const count = freeSet.size;
          const score = count * 1000 + len;
          if (count > 0 && score > bestScore) {
            bestScore = score;
            best = { d, s, count, len, freeNames: [...freeSet].map(vi => respondentNames[visibleWithIdx[vi].i]) };
          }
        }
      }
    }
    if (!best) return null;
    return {
      ...best,
      day:            allDays[best.d],
      time:           fmtH(G_START + best.s / SPH),
      endTime:        fmtH(G_START + (best.s + best.len) / SPH),
      isFullDuration: best.len === slotsNeeded,
    };
  }, [visibleRespondents, visibleWithIdx, slotsNeeded]);

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />
      <div className="app-nav">
        <span style={{ width: 48 }} />
        <span className="nav-title">結果</span>
        <span style={{ width: 48 }} />
      </div>

      {/* Legend + best time */}
      <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ width: 14, height: 14, borderRadius: 3, background: heatColor(n, 4), border: '1px solid rgba(95,132,162,0.15)' }} />
            ))}
            <span style={{ fontSize: 10, color: '#AAA', marginLeft: 2 }}>有空人數：少 → 多</span>
          </div>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>已選取 {visibleCount} 人</span>
        </div>
        {visibleCount === 0 && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#E57373', fontWeight: 500 }}>請至少選取一位</div>
        )}
        {bestSlot && visibleCount > 0 && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(95,132,162,0.08)', borderRadius: 10, border: '1px solid rgba(95,132,162,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#5F84A2' }}>★</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5F84A2' }}>最佳時段</span>
                {!bestSlot.isFullDuration && <span style={{ fontSize: 10, color: '#AAA', fontWeight: 400 }}>(時段不足)</span>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#5F84A2' }}>{bestSlot.count}/{visibleCount} 人有空</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2F4156', marginBottom: bestSlot.freeNames.length ? 6 : 0 }}>
              {bestSlot.day.label} {bestSlot.day.date} · {bestSlot.time}–{bestSlot.endTime}
            </div>
            {bestSlot.freeNames.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {bestSlot.freeNames.map(n => (
                  <span key={n} style={{ padding: '2px 8px', borderRadius: 10, background: '#1A1A1A', color: '#fff', fontSize: 10, fontWeight: 600 }}>{n}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', flexShrink: 0, padding: '0 4px' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} style={{
            background: 'none', border: 'none', fontSize: 22, fontFamily: 'inherit',
            color: page > 0 ? '#5F84A2' : '#DDD', padding: '8px 12px', minWidth: 44,
            cursor: page > 0 ? 'pointer' : 'default',
          }}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#888' }}>
            {pageNavLabel(pageDays)}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{
            background: 'none', border: 'none', fontSize: 22, fontFamily: 'inherit',
            color: page < totalPages - 1 ? '#5F84A2' : '#DDD', padding: '8px 12px', minWidth: 44,
            cursor: page < totalPages - 1 ? 'pointer' : 'default',
          }}>›</button>
        </div>
      )}

      {/* Heatmap grid */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {/* Day headers */}
        <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
          {pageDays.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0 5px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.label}</div>
              <div style={{ width: 20, height: 20, borderRadius: 10, margin: '2px auto 0', fontSize: 11, fontWeight: 700, color: '#2F4156', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.date}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', userSelect: 'none' }}>
          {/* Hour labels */}
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            {Array.from({ length: TOTAL }, (_, s) => (
              <div key={s} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 1, borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent' }}>
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
                  const key   = `${globalIdx}-${slot}`;
                  const count = visibleRespondents.filter(r => r[key] === 1).length;
                  return (
                    <div key={slot} style={{
                      height: SLOT_H,
                      background: heatColor(count, visibleCount),
                      borderTop: slot % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent',
                    }} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        {/* Respondents — selectable filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {respondentNames.map((n, i) => {
            const sel = selected.has(i);
            const color = COLORS[i % 4];
            return (
              <div key={i} onClick={() => toggleRespondent(i)} style={{
                display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                background: sel ? 'rgba(183,208,225,0.3)' : '#F5F5F5',
                border: `1.5px solid ${sel ? color : '#E5E5E5'}`,
                borderRadius: 20, padding: '4px 10px', transition: 'all 0.15s',
              }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: sel ? color : '#CCC', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div>
                <span style={{ fontSize: 11, fontWeight: sel ? 600 : 400, color: sel ? '#333' : '#AAA' }}>{n}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/grid', { state })} style={{
            flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #5F84A2',
            background: 'transparent', color: '#5F84A2', fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            重新填寫
          </button>
          <button className="btn-primary" onClick={() => navigate('/')} style={{ flex: 1, padding: '13px' }}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
