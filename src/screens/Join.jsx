import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Join() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data: m, error }) => {
        if (error || !m) { navigate('/', { replace: true }); return; }
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

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 18 }}>
      載入中…
    </div>
  );
}
