import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { IcCalendar, IcClock, IcUsers, IcCheck, IcStar, IcBell } from '../components/Icons';

const RESULT_SLOTS = [
  { day: 'Thu May 8', time: '10:00–11:00 AM', pct: 100, score: '4/4 free', badge: 'Best match', people: ['Alex', 'Sam', 'Jamie', 'Riley'] },
  { day: 'Tue May 6', time: '9:00–10:00 AM',  pct: 75,  score: '3/4 free', badge: null,         people: ['Alex', 'Sam', 'Jamie'] },
  { day: 'Wed May 7', time: '2:00–3:00 PM',   pct: 75,  score: '3/4 free', badge: null,         people: ['Sam', 'Jamie', 'Riley'] },
  { day: 'Mon May 5', time: '11:00 AM–12:00 PM', pct: 50, score: '2/4 free', badge: null,       people: ['Alex', 'Riley'] },
];

export default function Results() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState({ days: 4, hours: 13, mins: 22 });
  const [fastForwarding, setFastForwarding] = useState(false);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, mins } = prev;
        mins--;
        if (mins < 0) { mins = 59; hours--; }
        if (hours < 0) { hours = 23; days--; }
        if (days < 0) return { days: 0, hours: 0, mins: 0 };
        return { days, hours, mins };
      });
    }, 3000);
    return () => clearInterval(t);
  }, [phase]);

  const doFastForward = () => {
    setFastForwarding(true);
    let steps = 8, i = 0;
    const iv = setInterval(() => {
      i++;
      const frac = i / steps;
      setTimeLeft({
        days: Math.max(0, Math.round(4 * (1 - frac))),
        hours: Math.max(0, Math.round(13 * (1 - frac))),
        mins: Math.max(0, Math.round(22 * (1 - frac))),
      });
      if (i >= steps) {
        clearInterval(iv);
        setTimeout(() => setPhase('loading'), 600);
      }
    }, 120);
  };

  useEffect(() => {
    if (phase !== 'loading') return;
    const t = setTimeout(() => setPhase('results'), 2400);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="app-container">
      <StatusBar />
      <div className="app-nav">
        <span style={{ width: 60 }} />
        <span className="nav-title">{phase === 'loading' ? 'Analyzing…' : 'Results'}</span>
        <span style={{ width: 60 }} />
      </div>

      {phase === 'waiting' && (
        <div className="screen-content">
          <div style={{ margin: '16px 16px 0', background: 'linear-gradient(135deg,#FFF8E1,#FFFDE7)', border: '1px solid #FFE082', borderRadius: 14, padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFD54F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>⏳</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F57F17', marginBottom: 2 }}>Waiting for deadline</div>
              <div style={{ fontSize: 12, color: '#F9A825', lineHeight: 1.5 }}>Results will be calculated automatically when the survey closes on <strong>May 3</strong>.</div>
            </div>
          </div>

          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Time until deadline</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[
                { val: timeLeft.days, unit: 'days' },
                { val: timeLeft.hours, unit: 'hrs' },
                { val: timeLeft.mins, unit: 'min' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: timeLeft.days === 0 && timeLeft.hours === 0 ? '#EF5350' : '#111', letterSpacing: '-0.04em', transition: 'color 0.3s' }}>
                    {String(item.val).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 11, color: '#AAA', fontWeight: 500, marginTop: 2 }}>{item.unit}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Responses</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8a9da8' }}>3 of 4</div>
            </div>
            <div style={{ height: 5, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: '75%', height: '100%', background: '#8a9da8', borderRadius: 3 }} />
            </div>
            {[
              { name: 'Alex Morgan',  status: 'Responded · 12 slots', done: true,  color: '#8a9da8' },
              { name: 'Sam Chen',     status: 'Responded · 9 slots',  done: true,  color: '#26A69A' },
              { name: 'Jamie Park',   status: 'Responded · 7 slots',  done: true,  color: '#4DB6AC' },
              { name: 'Riley Torres', status: 'Waiting…',             done: false, color: '#80CBC4' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 3 ? '1px solid #F8F8F8' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{p.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: p.done ? '#888' : '#FFB300', marginTop: 1, fontWeight: p.done ? 400 : 600 }}>{p.status}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, background: p.done ? '#e8eef1' : '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.done ? <IcCheck size={12} color="#8a9da8" /> : <span style={{ fontSize: 11 }}>⏳</span>}
                </div>
              </div>
            ))}
            <button style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 10, background: '#FFFDE7', border: '1px solid #FFE082', color: '#F57F17', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IcBell /> Remind Riley Torres
            </button>
          </div>

          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Event</div>
            {[
              { icon: <IcCalendar />, label: 'Q2 Planning Kickoff' },
              { icon: <IcClock />,    label: '60 min · May 5–9' },
              { icon: <IcUsers />,    label: '4 participants · PST' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 2 ? '1px solid #F8F8F8' : 'none' }}>
                <div style={{ color: '#8a9da8', flexShrink: 0 }}>{row.icon}</div>
                <span style={{ fontSize: 13, color: '#444', fontWeight: 500 }}>{row.label}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 16px 32px' }}>
            <button onClick={doFastForward} disabled={fastForwarding} style={{ width: '100%', padding: '14px', borderRadius: 12, background: fastForwarding ? '#F0F0F0' : '#8a9da8', color: fastForwarding ? '#AAA' : '#fff', border: 'none', cursor: fastForwarding ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
              {fastForwarding
                ? <><div style={{ width: 16, height: 16, border: '2px solid #CCC', borderTopColor: '#888', borderRadius: 8, animation: 'spin 0.6s linear infinite' }} /> Jumping to deadline…</>
                : <>⏭ Fast-forward to deadline</>
              }
            </button>
            <button onClick={() => navigate('/')} style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 10, background: 'transparent', border: '1.5px solid #E0E0E0', color: '#888', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
              ← Back to home
            </button>
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 20 }}>
          <div className="spinner" style={{ width: 52, height: 52, borderWidth: 3 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Finding best times</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>Analyzing 5 calendars across May 5–9…</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {[
              { label: 'Fetched 5 calendars', done: true },
              { label: 'Identified busy slots', done: true },
              { label: 'Finding 1-hour overlaps', done: false },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, background: item.done ? '#8a9da8' : '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.done ? <IcCheck size={12} /> : <div style={{ width: 8, height: 8, borderRadius: 4, background: '#CCC' }} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: item.done ? '#111' : '#BBB' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="screen-content">
          <div className="section-head" style={{ paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <IcStar /><span style={{ fontSize: 12, fontWeight: 700, color: '#FFB300', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Best match</span>
            </div>
          </div>
          <div className="result-card pop-in">
            <div className="result-label">Recommended time</div>
            <div className="result-time">Thu May 8, 10 – 11 AM</div>
            <div className="result-date">PST · 60 minutes · 4 of 4 available</div>
            <div className="result-score">
              <div className="score-bar-wrap"><div className="score-bar" style={{ width: '100%' }} /></div>
              <span className="score-pct">100%</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <div className="avatar-stack">
                {['A', 'S', 'J', 'R'].map((l, i) => (
                  <div key={i} className="avatar" style={{ background: 'rgba(255,255,255,0.35)', color: '#fff', border: '2px solid rgba(255,255,255,0.5)', width: 26, height: 26, fontSize: 10 }}>{l}</div>
                ))}
              </div>
              <span style={{ fontSize: 12, opacity: 0.8, paddingTop: 3 }}>All 4 participants free</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>All options</span>
            <span style={{ fontSize: 12, color: '#888' }}>4 slots found</span>
          </div>

          {RESULT_SLOTS.map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, margin: '0 16px 8px', padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, border: i === 0 ? '1.5px solid #c5d2d8' : '1.5px solid transparent' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: i === 0 ? '#e8eef1' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IcCalendar />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{s.day} · {s.time}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.pct === 100 ? '#8a9da8' : '#c5d2d8', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#888', fontWeight: 500, flexShrink: 0 }}>{s.score}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                {s.badge && <div style={{ background: '#e8eef1', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#6b8592' }}>{s.badge}</div>}
                <div style={{ display: 'flex' }}>
                  {(s.people || []).map((name, pi) => (
                    <div key={pi} title={name} style={{ width: 20, height: 20, borderRadius: 10, background: ['#8a9da8', '#26A69A', '#4DB6AC', '#80CBC4'][pi % 4], color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', marginLeft: pi > 0 ? -5 : 0 }}>{name[0]}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="card" style={{ margin: '12px 16px' }}>
            <div className="card-title">Responses</div>
            {[
              { name: 'Alex Morgan',    status: 'Responded · 8 slots', done: true,  color: '#8a9da8' },
              { name: 'Sam Chen',       status: 'Responded · 6 slots', done: true,  color: '#26A69A' },
              { name: 'Jamie Park',     status: 'Responded · 5 slots', done: true,  color: '#4DB6AC' },
              { name: 'Riley Torres',   status: 'Waiting…',            done: false, color: '#80CBC4' },
              { name: 'You (organizer)',status: 'Responded',            done: true,  color: '#6b8592' },
            ].map((p, i) => (
              <div key={i} className="participant-row">
                <div className="avatar" style={{ background: p.color, margin: 0, width: 28, height: 28, fontSize: 11 }}>{p.name[0]}</div>
                <div>
                  <div className="p-name">{p.name}</div>
                  <div className="p-status">{p.status}</div>
                </div>
                <div className={`p-badge ${p.done ? 'done' : 'pending'}`}>{p.done ? 'Done' : 'Pending'}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '4px 16px 32px' }}>
            <button className="btn-primary" onClick={() => navigate('/confirm')}>
              Confirm this time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
