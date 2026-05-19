import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function Join() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem(`meeting_${id}`);
    if (!raw) { navigate('/', { replace: true }); return; }
    const m = JSON.parse(raw);
    navigate('/grid', {
      replace: true,
      state: {
        rangeStart: m.rangeStart,
        rangeEnd: m.rangeEnd,
        startSlot: m.startSlot,
        endSlot: m.endSlot,
        allDay: m.allDay,
        eventName: m.name,
      },
    });
  }, [id, navigate]);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 14 }}>
      載入中…
    </div>
  );
}
