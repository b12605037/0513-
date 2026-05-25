import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useDesktop } from '../hooks/useDesktop';

const SLOT_MIN = 30;
const SPH = 60 / SLOT_MIN;
const SLOT_H = 30;
const SLOT_H_DESKTOP = 54;
const LABEL_W = 52;
const LABEL_W_DESKTOP = 72;
const DAYS_PER_PAGE = 4;
const DESKTOP_DAYS_PER_PAGE = 7;
const FREE_COLOR = '#8A9DA8';
const DOW    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_ZH = ['週日','週一','週二','週三','週四','週五','週六'];
const DOW_IDX = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtH24 = h => {
  const hr = Math.floor(h) % 24, min = Math.round((h - Math.floor(h)) * 60);
  return `${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
};
const fmtHLabel = h => {
  const hr = Math.floor(h) % 24;
  if (hr === 0) return '12am';
  if (hr === 12) return '12pm';
  return hr < 12 ? `${hr}am` : `${hr - 12}pm`;
};
const fmtH = h => {
  const hr = Math.floor(h), min = Math.round((h - hr) * 60);
  const period = hr < 12 ? 'am' : 'pm';
  const dh = (hr === 0 || hr === 12) ? 12 : hr % 12;
  return min === 0 ? `${dh}${period}` : `${dh}:${String(min).padStart(2, '0')}${period}`;
};
const fmtDur = (slots) => {
  const mins = slots * SLOT_MIN;
  if (mins < 60) return `${mins} 分鐘`;
  return `${mins / 60} 小時`;
};

function buildAllDays(rangeStartTs, rangeEndTs, dateList) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dateList && dateList.length > 0) {
    return [...dateList].map(ts => new Date(ts)).sort((a,b) => a-b)
      .map(d => ({ label: DOW[d.getDay()], date: String(d.getDate()), month: d.getMonth() }));
  }
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

export default function Results() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const isDesktop = useDesktop();

  const G_START = state?.allDay ? 0  : Math.floor((state?.startSlot ?? 16) / 2);
  const G_END   = state?.allDay ? 24 : Math.ceil((state?.endSlot   ?? 36) / 2);
  const TOTAL   = (G_END - G_START) * SPH;

  const allDays   = useMemo(() => buildAllDays(state?.rangeStart, state?.rangeEnd, state?.dateList), [state]);
  const totalDays = allDays.length;
  const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

  const [responses, setResponses]         = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!state?.meetingId) { setLoading(false); return; }
    supabase.from('responses').select('respondent_name,slots')
      .eq('meeting_id', state.meetingId)
      .then(({ data }) => {
        if (data) {
          const deduped = Object.values(
            data.reduce((acc, r) => ({ ...acc, [r.respondent_name]: r }), {})
          );
          setResponses(deduped);
        }
        setLoading(false);
      });
  }, [state?.meetingId]);

  const allRespondents  = useMemo(() => responses.map(r => r.slots), [responses]);
  const respondentNames = useMemo(() => responses.map(r => r.respondent_name), [responses]);
  const COLORS = ['#194569', '#5F84A2', '#91AEC4', '#8A9DA8'];

  const _today = new Date();
  const todayM = _today.getMonth();
  const todayD = _today.getDate();

  const hasDuration = (state?.duration ?? 0) > 0 && (state?.duration ?? 0) < 1440;

  const [page, setPage]                   = useState(0);
  const [desktopPage, setDesktopPage]     = useState(0);
  const [selected, setSelected]           = useState(new Set());
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [heatmapExpanded, setHeatmapExpanded] = useState(!hasDuration);

  useEffect(() => {
    setSelected(new Set(responses.map((_, i) => i)));
  }, [responses.length]);

  // Desktop: 7 days per page; Mobile: 4 days per page
  const mobilePageStart   = page * DAYS_PER_PAGE;
  const desktopPageStart  = desktopPage * DESKTOP_DAYS_PER_PAGE;
  const desktopTotalPages = Math.ceil(totalDays / DESKTOP_DAYS_PER_PAGE);
  const pageStart = isDesktop ? desktopPageStart : mobilePageStart;
  const pageDays  = isDesktop
    ? allDays.slice(desktopPageStart, desktopPageStart + DESKTOP_DAYS_PER_PAGE)
    : allDays.slice(mobilePageStart, mobilePageStart + DAYS_PER_PAGE);
  const slotH = isDesktop ? SLOT_H_DESKTOP : SLOT_H;
  const labelW = isDesktop ? LABEL_W_DESKTOP : LABEL_W;

  const toggleRespondent = (i) =>
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const visibleRespondents = allRespondents.filter((_, i) => selected.has(i));
  const visibleCount = visibleRespondents.length;
  const slotsNeeded  = Math.max(1, Math.ceil((state?.duration ?? 30) / SLOT_MIN));

  const { bestSlots, isDegrade } = useMemo(() => {
    if (visibleCount === 0) return { bestSlots: [], isDegrade: false };
    const vwi = allRespondents.map((r, i) => ({ r, i })).filter(({ i }) => selected.has(i));
    const N = vwi.length;

    const findFullSlots = (minCount) => {
      const candidates = [];
      for (let d = 0; d < totalDays; d++) {
        for (let s = 0; s <= TOTAL - slotsNeeded; s++) {
          const free = vwi.filter(({ r }) => {
            for (let l = 0; l < slotsNeeded; l++)
              if (r[`${d}-${s+l}`] !== 1) return false;
            return true;
          });
          if (free.length >= minCount) {
            candidates.push({
              key: `${d}-${s}`, d, s, rawS: s,
              count: free.length, actualSlots: slotsNeeded,
              freeNames: free.map(({ i }) => respondentNames[i]),
              day: allDays[d],
              time: fmtH(G_START + s / SPH),
              endTime: fmtH(G_START + (s + slotsNeeded) / SPH),
            });
          }
        }
      }
      return candidates;
    };

    const findShorterSlots = (minCount) => {
      const candidates = [];
      for (let d = 0; d < totalDays; d++) {
        for (let s = 0; s < TOTAL; s++) {
          let free = vwi, maxLen = 0, bestFree = [];
          for (let l = 0; s + l < TOTAL; l++) {
            free = free.filter(({ r }) => r[`${d}-${s+l}`] === 1);
            if (free.length >= minCount) { maxLen = l + 1; bestFree = free; }
            else break;
          }
          if (maxLen > 0 && maxLen < slotsNeeded) {
            candidates.push({
              key: `${d}-${s}`, d, s, rawS: s,
              count: bestFree.length, actualSlots: maxLen,
              freeNames: bestFree.map(({ i }) => respondentNames[i]),
              day: allDays[d],
              time: fmtH(G_START + s / SPH),
              endTime: fmtH(G_START + (s + maxLen) / SPH),
            });
          }
        }
      }
      return candidates;
    };

    const pickNonOverlapping = (candidates) => {
      candidates.sort((a, b) => b.count - a.count || b.actualSlots - a.actualSlots || a.d - b.d || a.s - b.s);
      const picked = [], blocked = new Set();
      for (const c of candidates) {
        let skip = false;
        for (let l = 0; l < c.actualSlots; l++) { if (blocked.has(`${c.d}-${c.s+l}`)) { skip = true; break; } }
        if (!skip) {
          picked.push(c);
          for (let l = 0; l < c.actualSlots; l++) blocked.add(`${c.d}-${c.s+l}`);
        }
      }
      picked.sort((a, b) => b.actualSlots - a.actualSlots || b.count - a.count || a.d - b.d || a.s - b.s);
      return picked;
    };

    const tagSlots = (slots, fullDur, allPeople) => slots.map(c => ({
      ...c,
      isPerfect: allPeople && fullDur,
      label: (allPeople && fullDur ? '✓ ' : '⚠️ ') +
        (fullDur
          ? `${c.count}/${N} 人・${fmtDur(slotsNeeded)}`
          : `${c.count}/${N} 人・僅 ${fmtDur(c.actualSlots)}`),
    }));

    const p1 = findFullSlots(N);
    if (p1.length > 0) return { bestSlots: tagSlots(pickNonOverlapping(p1), true, true), isDegrade: false };
    const p2 = findShorterSlots(N);
    if (p2.length > 0) return { bestSlots: tagSlots(pickNonOverlapping(p2), false, true), isDegrade: true };
    if (N > 1) {
      const p3 = findFullSlots(N - 1);
      if (p3.length > 0) return { bestSlots: tagSlots(pickNonOverlapping(p3), true, false), isDegrade: true };
      const p4 = findShorterSlots(N - 1);
      if (p4.length > 0) return { bestSlots: tagSlots(pickNonOverlapping(p4), false, false), isDegrade: true };
    }
    return { bestSlots: [], isDegrade: false };
  }, [selected, responses, slotsNeeded, totalDays, TOTAL, G_START]);

  const toggleSlot = (key) =>
    setSelectedSlots(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const selectedList = bestSlots.filter(s => selectedSlots.has(s.key));

  const shareMessage = selectedList.length === 0 ? '' :
    selectedList.length === 1
      ? `嗨大家！會議時間確定囉\n\n📅 ${DOW_ZH[DOW_IDX[selectedList[0].day.label]]} ${selectedList[0].day.date} ${fmtH24(G_START + selectedList[0].rawS / SPH)}–${fmtH24(G_START + (selectedList[0].rawS + selectedList[0].actualSlots) / SPH)}`
      : `嗨大家！以下是我們的會議時間 📅\n\n` +
        selectedList.map(s => `• ${DOW_ZH[DOW_IDX[s.day.label]]} ${s.day.date} ${fmtH24(G_START + s.rawS / SPH)}–${fmtH24(G_START + (s.rawS + s.actualSlots) / SPH)}`).join('\n');

  const handleShareLine = () => {
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const dayPeaks = useMemo(() => pageDays.map((_, i) => {
    const gi = pageStart + i;
    let max = 0;
    for (let s = 0; s < TOTAL; s++) {
      const cnt = visibleRespondents.filter(r => r[`${gi}-${s}`] === 1).length;
      if (cnt > max) max = cnt;
    }
    return max;
  }), [pageDays, pageStart, visibleRespondents, TOTAL]);

  // ── Slot cards (reused by desktop left col + mobile) ──────────────────────
  const slotCards = (
    <>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#CCC', fontSize: 18, paddingTop: 48 }}>載入中…</div>
      ) : bestSlots.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#CCC', fontSize: 18, paddingTop: 48, lineHeight: 2 }}>
          {visibleCount === 0 ? '請先選取成員' : '沒有找到共同空閒時段'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isDegrade && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#92400E', fontWeight: 500, lineHeight: 1.5 }}>
              找不到完全符合的時段，以下是最接近的選項
            </div>
          )}
          {bestSlots.map((slot) => {
            const isSel = selectedSlots.has(slot.key);
            return (
              <div key={slot.key} onClick={() => toggleSlot(slot.key)} style={{ background: '#fff', borderRadius: 14, padding: '11px 12px', border: isSel ? '2px solid #8A9DA8' : '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: isSel ? '0 2px 12px rgba(47,65,86,0.1)' : 'none', transition: 'all 0.15s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
                    {DOW_ZH[DOW_IDX[slot.day.label]]} {slot.day.date} · {fmtH24(G_START + slot.rawS / SPH)}–{fmtH24(G_START + (slot.rawS + slot.actualSlots) / SPH)}
                  </span>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: slot.isPerfect ? '#5F84A2' : '#92400E', background: slot.isPerfect ? 'rgba(95,132,162,0.12)' : 'rgba(253,230,138,0.5)', borderRadius: 6, padding: '2px 7px' }}>
                      {slot.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {slot.freeNames.map(n => (
                      <span key={n} style={{ fontSize: 13, color: '#888', background: '#F5F5F5', borderRadius: 6, padding: '1px 6px' }}>{n}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, border: isSel ? 'none' : '1.5px solid #DDD', background: isSel ? '#8A9DA8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSel && <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5"/></svg>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Share bar ─────────────────────────────────────────────────────────────
  const lineIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
  );

  const shareBar = selectedList.length > 0 && (
    <div style={{ padding: '8px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
      <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 15, color: '#555', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {selectedList.map(s => `${DOW_ZH[DOW_IDX[s.day.label]]} ${s.day.date} · ${fmtH24(G_START + s.rawS / SPH)}–${fmtH24(G_START + (s.rawS + s.actualSlots) / SPH)}`).join('、')}
        </div>
        <button onClick={handleShareLine} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#8FA99A', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          {lineIcon} 傳送至 LINE
        </button>
      </div>
    </div>
  );

  // ── Heatmap day header & grid body (shared, styled per isDesktop) ─────────
  const heatmapDayHeader = (
    <div style={{ display: 'flex', paddingLeft: labelW, background: '#fff', borderBottom: isDesktop ? '2px solid #DDD' : '1px solid #E0E0E0', flexShrink: 0 }}>
      {pageDays.map((d, i) => {
        const isToday = Number(d.date) === todayD && d.month === todayM;
        return (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: isDesktop ? '10px 0 12px' : '8px 0', minWidth: isDesktop ? 100 : undefined, borderLeft: isDesktop && i > 0 ? '1px solid #EBEBEB' : 'none' }}>
            {isDesktop ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? FREE_COLOR : '#888', letterSpacing: '-0.01em' }}>
                  {MON[d.month]} {d.date}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? FREE_COLOR : '#AAA', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {d.label}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9DA8', letterSpacing: '0.06em', marginBottom: 4 }}>{DOW_ZH[DOW_IDX[d.label]]}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 14, background: isToday ? '#8A9DA8' : 'transparent' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: isToday ? '#fff' : '#8A9DA8' }}>{d.date}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const heatmapGridBody = (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', userSelect: 'none' }}>
        <div style={{ width: labelW, flexShrink: 0, borderRight: isDesktop ? '1px solid #E0E0E0' : 'none' }}>
          {Array.from({ length: TOTAL }, (_, s) => (
            <div key={s} style={{ height: slotH, display: 'flex', alignItems: 'flex-start', paddingLeft: isDesktop ? 10 : 8, paddingTop: isDesktop ? 4 : 3, borderTop: s % SPH === 0 ? (isDesktop ? '1px solid #CCC' : '1px solid #E0E0E0') : '1px dashed #EBEBEB' }}>
              {s % SPH === 0 && <span style={{ fontSize: 13, fontWeight: isDesktop ? 700 : 600, color: isDesktop ? '#888' : '#AAA', lineHeight: 1 }}>{isDesktop ? fmtHLabel(G_START + s / SPH).toUpperCase() : fmtHLabel(G_START + s / SPH)}</span>}
            </div>
          ))}
        </div>
        {pageDays.map((_, i) => {
          const gi = pageStart + i;
          return (
            <div key={gi} style={{ flex: 1, borderLeft: '1px solid #E0E0E0', minWidth: isDesktop ? 100 : undefined }}>
              {Array.from({ length: TOTAL }, (_, slot) => {
                const key = `${gi}-${slot}`;
                const count = visibleRespondents.filter(r => r[key] === 1).length;
                return (
                  <div key={slot} style={{ height: slotH, background: heatColor(count, visibleCount), borderTop: slot % SPH === 0 ? (isDesktop ? '1px solid #CCC' : '1px solid #E0E0E0') : '1px dashed #EBEBEB' }} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Mobile heatmap nav bar ────────────────────────────────────────────────
  const mobileHeatmapNav = (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 6px 10px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
      <button onClick={() => setPage(p => Math.max(0, p - 1))} style={{ background: 'none', border: 'none', fontSize: 28, color: page > 0 ? '#5F84A2' : '#DDD', padding: '0 10px', cursor: page > 0 ? 'pointer' : 'default', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: 19, fontWeight: 700, color: '#111' }}>{pageNavLabel(pageDays)}</span>
      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ background: 'none', border: 'none', fontSize: 28, color: page < totalPages - 1 ? '#5F84A2' : '#DDD', padding: '0 10px', cursor: page < totalPages - 1 ? 'pointer' : 'default', fontFamily: 'inherit', lineHeight: 1 }}>›</button>
      <span style={{ width: 38 }} />
    </div>
  );

  // ── Respondent chips (shared) ─────────────────────────────────────────────
  const respondentChips = (
    <div style={{ padding: isDesktop ? '10px 32px' : '8px 16px', background: '#fff', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {respondentNames.map((n, i) => {
          const sel = selected.has(i);
          const color = COLORS[i % 4];
          return (
            <div key={i} onClick={() => toggleRespondent(i)} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: sel ? 'rgba(183,208,225,0.3)' : '#F5F5F5', border: `1.5px solid ${sel ? color : '#E5E5E5'}`, borderRadius: 20, padding: isDesktop ? '6px 14px' : '4px 10px', transition: 'all 0.15s' }}>
              <div style={{ width: isDesktop ? 22 : 18, height: isDesktop ? 22 : 18, borderRadius: isDesktop ? 11 : 9, background: sel ? color : '#CCC', color: '#fff', fontSize: isDesktop ? 13 : 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div>
              <span style={{ fontSize: isDesktop ? 16 : 14, fontWeight: sel ? 600 : 400, color: sel ? '#333' : '#AAA' }}>{n}</span>
            </div>
          );
        })}
        {visibleCount === 0 && <span style={{ fontSize: 14, color: '#E57373', fontWeight: 500 }}>請至少選取一位</span>}
      </div>
    </div>
  );

  return (
    <div className="app-container">

      {/* ── Nav ── */}
      {isDesktop ? (
        <div style={{ height: 64, borderBottom: '1px solid #F0F0F0', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#fff' }}>
          <div style={{ padding: '0 32px', display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
            <span style={{ flex: 1, fontSize: 20, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state?.eventName ?? '結果'}
            </span>
            <button onClick={() => navigate('/grid', { state })}
              style={{ padding: '11px 28px', borderRadius: 10, border: '1.5px solid #8A9DA8', background: 'transparent', color: '#8A9DA8', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              重新填寫
            </button>
          </div>
        </div>
      ) : (
        <div className="app-nav">
          <span style={{ width: 48 }} />
          <span className="nav-title">結果</span>
          <span style={{ width: 48 }} />
        </div>
      )}

      {/* ── Respondent chips ── */}
      {respondentChips}

      {isDesktop ? (
        /* ── Desktop layout ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: best slots column (only when duration is set) */}
          {hasDuration && (
            <>
              <div style={{ width: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '10px 16px', background: '#F8F8F8' }}>
                  {slotCards}
                </div>
                {shareBar}
              </div>
              <div style={{ width: 1, background: '#E0E4E8', flexShrink: 0 }} />
            </>
          )}

          {/* Left arrow */}
          <button onClick={() => setDesktopPage(p => Math.max(0, p - 1))}
            style={{ width: 52, flexShrink: 0, background: 'none', border: 'none', fontSize: 34,
              color: desktopTotalPages > 1 && desktopPage > 0 ? FREE_COLOR : '#DDD',
              cursor: desktopTotalPages > 1 && desktopPage > 0 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRight: '1px solid #F0F0F0' }}>‹</button>

          {/* Heatmap */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {heatmapDayHeader}
            {heatmapGridBody}
          </div>

          {/* Right arrow */}
          <button onClick={() => setDesktopPage(p => Math.min(desktopTotalPages - 1, p + 1))}
            style={{ width: 52, flexShrink: 0, background: 'none', border: 'none', fontSize: 34,
              color: desktopTotalPages > 1 && desktopPage < desktopTotalPages - 1 ? FREE_COLOR : '#DDD',
              cursor: desktopTotalPages > 1 && desktopPage < desktopTotalPages - 1 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderLeft: '1px solid #F0F0F0' }}>›</button>
        </div>
      ) : (
        /* ── Mobile layout ── */
        <>
          {hasDuration && (
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '10px 16px', background: '#F8F8F8' }}>
              {slotCards}
            </div>
          )}

          {!hasDuration && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {mobileHeatmapNav}
              {heatmapDayHeader}
              {heatmapGridBody}
            </div>
          )}

          {hasDuration && shareBar}

          {hasDuration && (
            <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
              <button onClick={() => setHeatmapExpanded(true)} style={{ width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', gap: 3, flex: 1, alignItems: 'center' }}>
                  {pageDays.map((d, i) => (
                    <div key={i} style={{ flex: 1 }}>
                      <div style={{ height: 12, borderRadius: 3, background: dayPeaks[i] > 0 ? heatColor(dayPeaks[i], visibleCount) : '#EFEFEF' }} />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 14, color: '#999', fontWeight: 500, flexShrink: 0 }}>時段熱圖</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <polyline points="2,9 7,4 12,9"/>
                </svg>
              </button>
            </div>
          )}

          <div style={{ padding: '10px 16px 16px', background: '#fff', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
            <button onClick={() => navigate('/grid', { state })} style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1.5px solid #5F84A2', background: 'transparent', color: '#5F84A2', fontSize: 19, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              重新填寫
            </button>
          </div>

          {hasDuration && heatmapExpanded && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '82%', background: '#fff', zIndex: 100, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 6px 10px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} style={{ background: 'none', border: 'none', fontSize: 28, color: page > 0 ? '#5F84A2' : '#DDD', padding: '0 10px', cursor: page > 0 ? 'pointer' : 'default', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 19, fontWeight: 700, color: '#111' }}>{pageNavLabel(pageDays)}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ background: 'none', border: 'none', fontSize: 28, color: page < totalPages - 1 ? '#5F84A2' : '#DDD', padding: '0 10px', cursor: page < totalPages - 1 ? 'pointer' : 'default', fontFamily: 'inherit', lineHeight: 1 }}>›</button>
                <button onClick={() => setHeatmapExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px 4px 0', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round">
                    <polyline points="2,5 7,10 12,5"/>
                  </svg>
                </button>
              </div>
              {heatmapDayHeader}
              {heatmapGridBody}
            </div>
          )}
        </>
      )}
    </div>
  );
}
