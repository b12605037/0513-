import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import mixpanel from '../lib/mixpanel';

export default function Join() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const referrer = new URLSearchParams(window.location.search).get('referrer') ?? 'other';
    // Try localStorage first (works immediately for the creator on their device)
    try {
      const cached = localStorage.getItem(`meetime_event_${id}`);
      if (cached) {
        const m = JSON.parse(cached);
        mixpanel.track('join_view', { category: 'fill_time', event_id: m.id, referrer, timestamp: new Date().toISOString() });
        // If user already filled this event, go straight to results
        try {
          const filledRaw = localStorage.getItem(`meetime_filled_${id}`);
          if (filledRaw) {
            const filled = JSON.parse(filledRaw);
            navigate('/results', {
              replace: true,
              state: {
                meetingId:  m.id,
                eventName:  m.name,
                myName:     filled.name,
                mySlots:    filled.slots,
                dateList:   m.dateList,
                startSlot:  m.startSlot,
                endSlot:    m.endSlot,
                allDay:     m.allDay,
                duration:   m.duration,
                rangeStart: m.rangeStart,
                rangeEnd:   m.rangeEnd,
              },
            });
            return;
          }
        } catch {}
        navigate('/grid', {
          replace: true,
          state: {
            meetingId:  m.id,
            eventName:  m.name,
            rangeStart: m.rangeStart,
            rangeEnd:   m.rangeEnd,
            dateList:   m.dateList,
            startSlot:  m.startSlot,
            endSlot:    m.endSlot,
            allDay:     m.allDay,
            duration:   m.duration,
            deadline:   m.deadline,
          },
        });
        return;
      }
    } catch {}

    // Fallback: fetch from Supabase (for other devices / cache miss)
    supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data: m, error }) => {
        if (error || !m) {
          setNotFound(true);
          return;
        }
        mixpanel.track('join_view', { category: 'fill_time', event_id: m.id, referrer, timestamp: new Date().toISOString() });
        // Cache for future visits
        try {
          localStorage.setItem(`meetime_event_${id}`, JSON.stringify({
            id:         m.id,
            name:       m.name,
            rangeStart: m.range_start,
            rangeEnd:   m.range_end,
            dateList:   m.date_list,
            startSlot:  m.start_slot,
            endSlot:    m.end_slot,
            allDay:     m.all_day,
            duration:   m.duration,
            deadline:   m.deadline,
          }));
        } catch {}
        // If user already filled this event, go straight to results
        try {
          const filledRaw = localStorage.getItem(`meetime_filled_${id}`);
          if (filledRaw) {
            const filled = JSON.parse(filledRaw);
            navigate('/results', {
              replace: true,
              state: {
                meetingId:  m.id,
                eventName:  m.name,
                myName:     filled.name,
                mySlots:    filled.slots,
                dateList:   m.date_list,
                startSlot:  m.start_slot,
                endSlot:    m.end_slot,
                allDay:     m.all_day,
                duration:   m.duration,
                rangeStart: m.range_start,
                rangeEnd:   m.range_end,
              },
            });
            return;
          }
        } catch {}
        navigate('/grid', {
          replace: true,
          state: {
            meetingId:  m.id,
            eventName:  m.name,
            rangeStart: m.range_start,
            rangeEnd:   m.range_end,
            dateList:   m.date_list,
            startSlot:  m.start_slot,
            endSlot:    m.end_slot,
            allDay:     m.all_day,
            duration:   m.duration,
            deadline:   m.deadline,
          },
        });
      });
  }, [id, navigate]);

  if (notFound) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#555' }}>連結無效或已過期</div>
      <div style={{ fontSize: 16, color: '#AAA' }}>請向活動發起人索取新的邀請連結</div>
      <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '12px 28px', borderRadius: 12, border: 'none', background: '#8A9DA8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>回首頁</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 18 }}>
      載入中…
    </div>
  );
}
