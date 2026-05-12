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

const fmtH = h => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

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

// Color for N out of total respondents
function heatColor(n, total) {
  if (n === 0 || total === 0) return 'transparent';
  const opacity = 0.2 + (n / total) * 0.8;
  return `rgba(71,128,88,${opacity.toFixed(2)})`;
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
  const myName  = state?.myName  ?? 'You';

  // Generate 3 deterministic mock respondents
  const mockSlots = useMemo(() => MOCK_NAMES.map((_, i) =>
    makeMockSlots(totalDays, TOTAL, 42 + i * 17)
  ), [totalDays, TOTAL]);

  const allRespondents = [mySlots, ...mockSlots];
  const respondentCount = allRespondents.length;
  const respondentNames = [myName, ...MOCK_NAMES];

  const [page, setPage] = useState(0);
  const pageStart = page * DAYS_PER_PAGE;
  const pageDays  = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);
  const navLabel  = pageNavLabel(pageDays);

  const slotsNeeded = Math.max(1, Math.ceil((state?.duration ?? 30) / SLOT_MIN));

  // Find best consecutive block of slotsNeeded slots where most people are free throughout
  const bestSlot = useMemo(() => {
    let best = null, bestCount = 0;
    for (let d = 0; d < totalDays; d++) {
      for (let s = 0; s <= TOTAL - slotsNeeded; s++) {
        const count = allRespondents.filter(r => {
          for (let k = 0; k < slotsNeeded; k++)
            if (r[`${d}-${s + k}`] !== 1) return false;
          return true;
        }).length;
        if (count > bestCount) { bestCount = count; best = { d, s, count }; }
      }
    }
    if (!best) return null;
    return {
      ...best,
      day:     allDays[best.d],
      time:    fmtH(G_START + best.s / SPH),
      endTime: fmtH(G_START + (best.s + slotsNeeded) / SPH),
    };
  }, [allRespondents, slotsNeeded]);

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />
      <div className="app-nav">
        <button className="nav-action" onClick={() => navigate(-1)}>← Back</button>
        <span className="nav-title">Result</span>
        <span style={{ width: 48 }} />
      </div>

      {/* Legend + best time */}
      <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ width: 14, height: 14, borderRadius: 3, background: heatColor(n, 4), border: '1px solid rgba(71,128,88,0.15)' }} />
            ))}
            <span style={{ fontSize: 10, color: '#AAA', marginLeft: 2 }}>Fewer → More available</span>
          </div>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{respondentCount} responded</span>
        </div>
        {bestSlot && (
          <div style={{ marginTop: 6, padding: '5px 10px', background: 'rgba(71,128,88,0.1)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: '#478058' }}>★</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#478058' }}>
              Best: {bestSlot.day.label} {bestSlot.day.date} · {bestSlot.time}–{bestSlot.endTime} · {bestSlot.count}/{respondentCount} free
            </span>
          </div>
        )}
      </div>

      {/* Heatmap grid */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {/* Day headers */}
        <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 20, borderBottom: '1px solid #EBEBEB' }}>
          {pageDays.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0 5px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.label}</div>
              <div style={{ width: 20, height: 20, borderRadius: 10, margin: '2px auto 0', fontSize: 11, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.date}</div>
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
                  const count = allRespondents.filter(r => r[key] === 1).length;
                  return (
                    <div key={slot} style={{
                      height: SLOT_H,
                      background: heatColor(count, respondentCount),
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 }}>
            {Array.from({ length: totalPages }, (_, i) => (
              <div key={i} onClick={() => setPage(i)} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, background: i === page ? '#478058' : '#E0E0E0', cursor: 'pointer', transition: 'all 0.2s' }} />
            ))}
          </div>
        )}

        {/* Respondents */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {respondentNames.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F5F5F5', borderRadius: 20, padding: '4px 10px' }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: ['#478058','#8a9da8','#26A69A','#4DB6AC'][i % 4], color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#444' }}>{n}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{
            flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #478058',
            background: 'transparent', color: '#478058', fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Edit
          </button>
          <button className="btn-primary" onClick={() => navigate('/')} style={{ flex: 1, padding: '13px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
