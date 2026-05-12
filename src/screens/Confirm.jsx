import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { IcCalendar, IcClock, IcUsers, IcCheck, IcBell, IcMail } from '../components/Icons';

export default function Confirm() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('confirm');
  const [sheet, setSheet] = useState(true);

  const doConfirm = () => {
    setSheet(false);
    setPhase('booking');
    setTimeout(() => setPhase('success'), 2000);
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <StatusBar />
      <div className="app-nav">
        <span style={{ width: 60 }} />
        <span className="nav-title">Confirm</span>
        <span style={{ width: 60 }} />
      </div>

      {phase === 'booking' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 52, height: 52, borderWidth: 3 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Booking meeting…</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Adding to 4 Google Calendars</div>
          </div>
        </div>
      )}

      {phase === 'success' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 0 }}>
          <div className="success-icon pop-in">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00BFA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>Booked! 🎉</div>
          <div style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
            Q2 Planning Kickoff has been added to all 4 calendars. Notifications sent via Gmail.
          </div>

          <div style={{ background: 'linear-gradient(135deg,#00BFA5,#00897B)', borderRadius: 16, padding: 20, width: '100%', color: '#fff', marginBottom: 20 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Scheduled</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Q2 Planning Kickoff</div>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 12 }}>Thu, May 8 · 10:00 – 11:00 AM PST</div>
            <div className="avatar-stack">
              {['A', 'S', 'J', 'R', 'Y'].map((l, i) => (
                <div key={i} className="avatar" style={{ background: 'rgba(255,255,255,0.3)', color: '#fff', border: '2px solid rgba(255,255,255,0.5)', width: 28, height: 28, fontSize: 11 }}>{l}</div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Notifications sent</div>
            {['alex@company.com', 'sam@company.com', 'jamie@company.com', 'riley@company.com'].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 3 ? '1px solid #F5F5F5' : 'none' }}>
                <div style={{ color: '#00BFA5' }}><IcMail /></div>
                <span style={{ fontSize: 13, color: '#555' }}>{e}</span>
                <div style={{ marginLeft: 'auto' }}><IcCheck size={14} color="#00BFA5" /></div>
              </div>
            ))}
          </div>

          <button className="btn-secondary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      )}

      {phase === 'confirm' && (
        <div className="screen-content">
          <div style={{ margin: '16px 16px 12px', background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#AAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Gmail notification preview</div>
            <div style={{ borderLeft: '3px solid #00BFA5', paddingLeft: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>📅 Timeful: Best time found!</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>from: noreply@timeful.app · to: you</div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                Hi Alex,<br />
                A best time has been found for <strong>Q2 Planning Kickoff</strong>: <span style={{ color: '#00BFA5', fontWeight: 600 }}>Thursday May 8, 10–11 AM PST</span>. All 4 participants are available.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Booking summary</div>
            {[
              { icon: <IcCalendar />, label: 'Event',        value: 'Q2 Planning Kickoff' },
              { icon: <IcClock />,    label: 'Time',         value: 'Thu May 8 · 10–11 AM PST' },
              { icon: <IcUsers />,    label: 'Participants', value: '4 people · all available' },
              { icon: <IcBell />,     label: 'Notifications',value: 'Gmail + Calendar invites' },
            ].map((item, i) => (
              <div key={i} className="info-row">
                <div className="info-icon">{item.icon}</div>
                <div>
                  <div className="info-label">{item.label}</div>
                  <div className="info-value">{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 0 8px' }}>
            <div style={{ padding: '0 20px 10px', fontSize: 13, fontWeight: 700, color: '#111' }}>What happens next</div>
            <div className="timeline">
              {[
                { label: 'Calendar invites sent to all participants', time: 'Immediately',   done: true },
                { label: 'Gmail confirmation emails sent',            time: 'Immediately',   done: true },
                { label: 'Reminders sent 1 hour before',             time: 'May 8, 9:00 AM', done: false },
                { label: 'Meeting starts',                            time: 'May 8, 10:00 AM',done: false },
              ].map((item, i) => (
                <div key={i} className="tl-item">
                  <div className={`tl-dot${item.done ? ' done' : ''}`}>
                    {item.done && <IcCheck size={12} />}
                  </div>
                  <div>
                    <div className="tl-label">{item.label}</div>
                    <div className="tl-time">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '4px 16px 32px' }}>
            <button className="btn-primary" onClick={doConfirm}>
              Confirm &amp; book for everyone
            </button>
          </div>
        </div>
      )}

      {sheet && phase === 'confirm' && (
        <div className="bottom-sheet-overlay" onClick={() => setSheet(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Confirm booking?</div>
            <div className="sheet-subtitle">This will add Q2 Planning Kickoff to all 4 participants' Google Calendars and send Gmail notifications.</div>
            <div style={{ background: '#F0F9F8', borderRadius: 10, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <IcCalendar />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Thu May 8 · 10:00 – 11:00 AM</div>
                <div style={{ fontSize: 12, color: '#00897B', marginTop: 2 }}>4/4 participants available · PST</div>
              </div>
            </div>
            <button className="btn-primary" onClick={doConfirm} style={{ marginBottom: 10 }}>
              Confirm &amp; book
            </button>
            <button className="btn-secondary" onClick={() => setSheet(false)}>
              Go back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
