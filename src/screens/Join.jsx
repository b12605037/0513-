import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import mixpanel from '../lib/mixpanel';

export default function Join() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Try localStorage first (works immediately for the creator on their device)
    try {
      const cached = localStorage.getItem(`meetime_event_${id}`);
      if (cached) {
        const m = JSON.parse(cached);
        mixpanel.track('加入活動', { 活動id: m.id, 活動名稱: m.name });
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
          mixpanel.track('加入活動失敗', { 活動id: id });
          setNotFound(true);
          return;
        }
        mixpanel.track('加入活動', { 活動id: m.id, 活動名稱: m.name });
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
