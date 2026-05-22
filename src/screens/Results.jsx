import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StatusBar from '../components/StatusBar';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 20;
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
  const first = pageDays[0], last = pageDays[pageDays.length - 1];
  return first.month === last.month
    ? `${MON[first.month]} ${first.date}–${last.date}`
    : `${MON[first.month]} ${first.date} – ${MON[last.month]} ${last.date}`;
}

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
  const f = scaled - lo, hi = lo + 1;
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

  const allDays   = useMemo(() => buildAllDays(state?.rangeStart, state?.rangeEnd), [state]);
  const totalDays = allDays.length;
  const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

  const mySlots = state?.mySlots ?? {};
  const myName  = state?.myName  ?? '你';

  const mockSlots = useMemo(() => MOCK_NAMES.map((_, i) =>
    makeMockSlots(totalDays, TOTAL, 42 + i * 17)
  ), [totalDays, TOTAL]);

  const allRespondents  = [mySlots, ...mockSlots];
  const respondentNames = [myName, ...MOCK_NAMES];
  const COLORS = ['#194569', '#5F84A2', '#91AEC4', '#8A9DA8'];

  const [page, setPage]                   = useState(0);
  const [selected, setSelected]           = useState(() => new Set(allRespondents.map((_, i) => i)));
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [heatmapExpanded, setHeatmapExpanded] = useState(false);
  const [copiedMsg, setCopiedMsg]         = useState(false);

  const pageStart = page * DAYS_PER_PAGE;
  const pageDays  = allDays.slice(pageStart, pageStart + DAYS_PER_PAGE);

  const toggleRespondent = (i) =>
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const visibleRespondents = allRespondents.filter((_, i) => selected.has(i));
  const visibleCount = visibleRespondents.length;
  const slotsNeeded  = Math.max(1, Math.ceil((state?.duration ?? 30) / SLOT_MIN));

  // All non-overlapping best slots, sorted by count desc then chronologically
  const allBestSlots = useMemo(() => {
    if (visibleCount === 0) return [];
    const vwi = allRespondents.map((r, i) => ({ r, i })).filter(({ i }) => selected.has(i));
    const candidates = [];
    for (let d = 0; d < totalDays; d++) {
      for (let s = 0; s <= TOTAL - slotsNeeded; s++) {
        const free = vwi.filter(({ r }) => {
          for (let len = 0; len < slotsNeeded; len++)
            if (r[`${d}-${s + len}`] !== 1) return false;
          return true;
        });
        if (free.length > 0) {
          candidates.push({
            key: `${d}-${s}`, d, s,
            count: free.length,
            freeNames: free.map(({ i }) => respondentNames[i]),
            day: allDays[d],
            time: fmtH(G_START + s / SPH),
            endTime: fmtH(G_START + (s + slotsNeeded) / SPH),
          });
        }
      }
    }
    candidates.sort((a, b) => b.count - a.count || a.d - b.d || a.s - b.s);
    const picked = [], blocked = new Set();
    for (const c of candidates) {
      let skip = false;
      for (let len = 0; len < slotsNeeded; len++) { if (blocked.has(`${c.d}-${c.s+len}`)) { skip = true; break; } }
      if (!skip) {
        picked.push(c);
        for (let len = 0; len < slotsNeeded; len++) blocked.add(`${c.d}-${c.s+len}`);
      }
    }
    return picked;
  }, [selected, allRespondents, slotsNeeded, totalDays, TOTAL, G_START]);

  const toggleSlot = (key) =>
    setSelectedSlots(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const selectedList = allBestSlots.filter(s => selectedSlots.has(s.key));

  const shareMessage = selectedList.length === 0 ? '' :
    `📅 以下是投票結果的可用時段，請確認哪個時間方便：\n\n` +
    selectedList.map(s => `✅ ${s.day.label} ${s.day.date} · ${s.time}–${s.endTime}（${s.count}/${visibleCount} 人有空）`).join('\n') +
    `\n\n請回覆可以的時段，謝謝！`;

  const handleCopyMsg = () => {
    navigator.clipboard.writeText(shareMessage).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    });
  };

  // Per-day peak heat for preview strip
  const dayPeaks = useMemo(() => pageDays.map((_, i) => {
    const gi = pageStart + i;
    let max = 0;
    for (let s = 0; s < TOTAL; s++) {
      const cnt = visibleRespondents.filter(r => r[`${gi}-${s}`] === 1).length;
      if (cnt > max) max = cnt;
    }
    return max;
  }), [pageDays, pageStart, visibleRespondents, TOTAL]);

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />
      <div className="app-nav">
        <span style={{ width: 48 }} />
        <span className="nav-title">結果</span>
        <span style={{ width: 48 }} />
      </div>

      {/* Respondent filter chips */}
      <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
          {visibleCount === 0 && <span style={{ fontSize: 11, color: '#E57373', fontWeight: 500 }}>請至少選取一位</span>}
        </div>
      </div>

      {/* Best slots list */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '10px 16px', background: '#F8F8F8' }}>
        {allBestSlots.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#CCC', fontSize: 14, paddingTop: 48, lineHeight: 2 }}>
            {visibleCount === 0 ? '請先選取成員' : '沒有找到共同空閒時段'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allBestSlots.map((slot, idx) => {
              const isSel = selectedSlots.has(slot.key);
              return (
                <div key={slot.key} onClick={() => toggleSlot(slot.key)} style={{
                  background: '#fff', borderRadius: 14, padding: '11px 12px',
                  border: isSel ? '2px solid #8A9DA8' : '1.5px solid #EBEBEB',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: isSel ? '0 2px 12px rgba(47,65,86,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {/* Heat indicator bar */}
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: heatColor(slot.count, visibleCount), flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      {idx === 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#8A9DA8', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>最佳</span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                        {slot.day.label} {slot.day.date} · {slot.time}–{slot.endTime}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {slot.freeNames.map(n => (
                        <span key={n} style={{ fontSize: 10, color: '#888', background: '#F5F5F5', borderRadius: 6, padding: '1px 6px' }}>{n}</span>
                      ))}
                    </div>
                  </div>

                  {/* Count + checkbox */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9FB5C3' }}>{slot.count}/{visibleCount}</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: 11,
                      border: isSel ? 'none' : '1.5px solid #DDD',
                      background: isSel ? '#8A9DA8' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSel && (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1.5,5.5 4.5,8.5 9.5,2.5"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Copy message panel — shown when ≥1 slot selected */}
      {selectedList.length > 0 && (
        <div style={{ padding: '8px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
          <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12, color: '#555', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {selectedList.map(s => `${s.day.label} ${s.day.date} · ${s.time}–${s.endTime}`).join('、')}
            </div>
            <button onClick={handleCopyMsg} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none',
              background: copiedMsg ? '#5F84A2' : '#8A9DA8',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap',
            }}>
              {copiedMsg ? '已複製 ✓' : '複製訊息'}
            </button>
          </div>
        </div>
      )}

      {/* Heatmap accordion */}
      <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
        <button onClick={() => setHeatmapExpanded(e => !e)} style={{
          width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center',
          gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {/* Day color preview strip */}
          <div style={{ display: 'flex', gap: 3, flex: 1, alignItems: 'center' }}>
            {pageDays.map((d, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 3, background: dayPeaks[i] > 0 ? heatColor(dayPeaks[i], visibleCount) : '#EFEFEF' }} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 500, flexShrink: 0 }}>時段熱圖</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round"
            style={{ transform: heatmapExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <polyline points="2,5 7,10 12,5"/>
          </svg>
        </button>

        {heatmapExpanded && (
          <div style={{ maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'none', borderTop: '1px solid #F0F0F0' }}>
            {/* Page nav (inside expanded heatmap) */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', borderBottom: '1px solid #F5F5F5' }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} style={{ background: 'none', border: 'none', fontSize: 20, color: page > 0 ? '#5F84A2' : '#DDD', padding: '4px 10px', cursor: page > 0 ? 'pointer' : 'default', fontFamily: 'inherit' }}>‹</button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888' }}>{pageNavLabel(pageDays)}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ background: 'none', border: 'none', fontSize: 20, color: page < totalPages - 1 ? '#5F84A2' : '#DDD', padding: '4px 10px', cursor: page < totalPages - 1 ? 'pointer' : 'default', fontFamily: 'inherit' }}>›</button>
              </div>
            )}
            {/* Day headers */}
            <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid #EBEBEB' }}>
              {pageDays.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 0' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#AAA', textTransform: 'uppercase' }}>{d.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8A9DA8' }}>{d.date}</div>
                </div>
              ))}
            </div>
            {/* Grid */}
            <div style={{ display: 'flex', userSelect: 'none' }}>
              <div style={{ width: LABEL_W, flexShrink: 0 }}>
                {Array.from({ length: TOTAL }, (_, s) => (
                  <div key={s} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 4, paddingTop: 1, borderTop: s % SPH === 0 ? '1px solid #EBEBEB' : '1px solid transparent' }}>
                    {s % SPH === 0 && <span style={{ fontSize: 8, fontWeight: 600, color: '#BBB' }}>{fmtH(G_START + s / SPH)}</span>}
                  </div>
                ))}
              </div>
              {pageDays.map((_, i) => {
                const gi = pageStart + i;
                return (
                  <div key={gi} style={{ flex: 1, borderLeft: i > 0 ? '1px solid #EBEBEB' : 'none' }}>
                    {Array.from({ length: TOTAL }, (_, slot) => {
                      const key = `${gi}-${slot}`;
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
        )}
      </div>

      {/* Bottom buttons */}
      <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
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
