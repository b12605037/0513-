import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { IcChevron, IcCalendar, IcClock, IcUsers, IcPlus } from '../components/Icons';
import { BOOKED_EVENTS, CAL_HOURS, CAL_START_HOUR, SLOT_H } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEK_DATES = ['5', '6', '7', '8', '9'];
const TODAY_IDX = 3;

function WeeklyCalendar({ onEventClick }) {
  const NOW_HOUR = 10, NOW_MIN = 24;
  const nowTop = (NOW_HOUR - CAL_START_HOUR + NOW_MIN / 60) * SLOT_H;

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', minWidth: 0 }}>
        <div style={{ width: 44, flexShrink: 0, paddingTop: 0 }}>
          {CAL_HOURS.map(h => (
            <div key={h} style={{ height: SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: '#BBB', whiteSpace: 'nowrap' }}>
                {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
              </span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {CAL_HOURS.map((h, i) => (
            <div key={h} style={{
              position: 'absolute', left: 0, right: 0,
              top: i * SLOT_H, height: SLOT_H,
              borderTop: `1px solid ${h === NOW_HOUR ? 'rgba(0,191,165,0.2)' : '#F0F0F0'}`,
            }} />
          ))}
          <div style={{ position: 'absolute', left: 0, right: 0, top: CAL_HOURS.length * SLOT_H, borderTop: '1px solid #F0F0F0' }} />

          <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: '#00BFA5', zIndex: 10, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#00BFA5', marginLeft: -4, flexShrink: 0 }} />
          </div>

          {[0, 1, 2, 3, 4].map(d => (
            <div key={d} style={{ position: 'absolute', left: `${d * 20}%`, width: '20%', top: 0, bottom: 0, borderLeft: d > 0 ? '1px solid #F0F0F0' : 'none' }} />
          ))}

          {BOOKED_EVENTS.map((ev, i) => {
            const top = (ev.startHour - CAL_START_HOUR + ev.startMin / 60) * SLOT_H;
            const height = (ev.durationMins / 60) * SLOT_H - 3;
            const left = `calc(${ev.day * 20}% + 2px)`;
            const width = 'calc(20% - 4px)';
            const isPending = ev.status === 'pending';
            return (
              <div key={i} onClick={() => onEventClick && onEventClick(ev)}
                style={{
                  position: 'absolute', top, left, width, height,
                  background: isPending ? 'rgba(0,191,165,0.12)' : ev.color,
                  border: isPending ? `1.5px dashed ${ev.color}` : 'none',
                  borderRadius: 6, padding: '3px 5px',
                  cursor: 'pointer', overflow: 'hidden',
                  boxShadow: isPending ? 'none' : '0 1px 4px rgba(0,0,0,0.15)',
                  zIndex: 5,
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}>
                <div style={{ fontSize: height > 36 ? 10 : 9, fontWeight: 700, color: isPending ? ev.color : '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: height > 36 ? 'normal' : 'nowrap' }}>
                  {ev.title}
                </div>
                {height > 36 && (
                  <div style={{ fontSize: 9, color: isPending ? ev.color : 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 500 }}>
                    {ev.startHour < 12 ? ev.startHour : ev.startHour - 12}:{String(ev.startMin).padStart(2, '0')}{ev.startHour < 12 ? 'a' : 'p'}
                    {' – '}
                    {(() => { const e = ev.startHour * 60 + ev.startMin + ev.durationMins; const eh = Math.floor(e / 60), em = e % 60; return `${eh < 12 ? eh : eh - 12}:${String(em).padStart(2, '0')}${eh < 12 ? 'a' : 'p'}`; })()}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ height: CAL_HOURS.length * SLOT_H }} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState('calendar');
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <StatusBar />

      <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0', padding: '56px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.03em' }}>Timeful</span>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.picture
                ? <img src={user.picture} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: 16, border: '2px solid #E0F5F2' }} alt="" />
                : <div style={{ width: 32, height: 32, borderRadius: 16, background: '#00BFA5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{(user.name || user.email || '?')[0].toUpperCase()}</div>
              }
              <button onClick={signOut} style={{ background: 'none', border: '1.5px solid #E0E0E0', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
            </div>
          ) : (
            <button onClick={() => navigate('/signin')} style={{ background: 'none', border: '1.5px solid #E0E0E0', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
          )}
        </div>
        <button onClick={() => navigate('/create')} style={{ background: '#00BFA5', border: 'none', borderRadius: 14, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: '#fff', padding: '0 20px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(0,191,165,0.35)', width: '100%' }}>
          <IcPlus /> New event
        </button>
      </div>

      {user ? (
        <>
          <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0', flexShrink: 0, padding: '0 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 40, gap: 8 }}>
              <button style={{ background: 'none', border: 'none', color: '#00BFA5', cursor: 'pointer', padding: '4px 2px' }}><IcChevron dir="left" size={16} /></button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>May 2025</span>
              <button style={{ background: 'none', border: 'none', color: '#00BFA5', cursor: 'pointer', padding: '4px 2px' }}><IcChevron dir="right" size={16} /></button>
            </div>
            <div style={{ display: 'flex', paddingLeft: 40, borderTop: '1px solid #F5F5F5' }}>
              {WEEK_DAYS.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '5px 0 7px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: i === TODAY_IDX ? '#00BFA5' : '#BBB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: i === TODAY_IDX ? '#00BFA5' : 'transparent', color: i === TODAY_IDX ? '#fff' : '#111', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>{WEEK_DATES[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
            {[['calendar', 'Calendar'], ['events', 'Events']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: tab === id ? '#00BFA5' : '#AAA', borderBottom: tab === id ? '2px solid #00BFA5' : '2px solid transparent' }}>{label}</button>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {tab === 'calendar' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 12, padding: '4px 16px', background: '#FAFAFA', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#AAA' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#00BFA5' }} /> Booked
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#AAA' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(0,191,165,0.15)', border: '1px dashed #00BFA5' }} /> Pending
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <WeeklyCalendar onEventClick={setSelectedEvent} />
                </div>
              </div>
            ) : (
              <div className="screen-content">
                <div style={{ margin: '12px 16px 0', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F57F17' }}>2 surveys need your response</div>
                    <div style={{ fontSize: 12, color: '#F9A825', marginTop: 1 }}>Fill in your availability before the deadlines</div>
                  </div>
                </div>
                <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Need your response</span>
                  <div className="count-badge">2</div>
                </div>
                {[
                  { name: 'Design review',    people: 3, responded: 1, deadline: 'May 12', daysLeft: 8 },
                  { name: '1:1 with manager', people: 2, responded: 0, deadline: 'May 15', daysLeft: 11 },
                ].map((ev, i) => (
                  <div key={i} style={{ margin: '0 16px 10px', background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1.5px solid #FFE0B2' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{ev.name}</div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Due {ev.deadline} · {ev.daysLeft} days left</div>
                      </div>
                      <div style={{ background: '#FFF3E0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#E65100', flexShrink: 0, marginLeft: 8 }}>Pending</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(ev.responded / ev.people) * 100}%`, height: '100%', background: '#FFB74D', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{ev.responded}/{ev.people} responded</span>
                    </div>
                    <button className="btn-primary" style={{ padding: '10px', fontSize: 13 }} onClick={() => navigate('/grid')}>
                      Fill in availability →
                    </button>
                  </div>
                ))}
                <div style={{ height: 8, background: '#F5F5F5', margin: '4px 0' }} />
                <div style={{ padding: '12px 16px 8px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Completed</span>
                </div>
                <div style={{ margin: '0 16px 10px', background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: 0.75 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Q2 Planning Kickoff</div>
                    <div style={{ background: '#E8F8F6', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#00897B' }}>✓ Done</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#B2DFDB', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>4/4 responded</span>
                  </div>
                </div>
                <div style={{ padding: '8px 16px 32px' }}>
                  <button className="btn-secondary" onClick={() => navigate('/create')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <IcPlus /> New event
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 48px' }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: '#CCC' }}>
            <IcCalendar />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 10, textAlign: 'center', letterSpacing: '-0.02em' }}>Your calendar lives here</div>
          <div style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>Sign in to view your schedule and find the best meeting times with your team.</div>
          <button className="btn-primary" onClick={() => navigate('/signin')} style={{ width: '100%' }}>Sign in</button>
        </div>
      )}

      {selectedEvent && (
        <div className="bottom-sheet-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: selectedEvent.color, marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="sheet-title" style={{ marginBottom: 4 }}>{selectedEvent.title}</div>
                <div style={{ fontSize: 13, color: '#00897B', fontWeight: 600, background: '#E8F8F6', display: 'inline-block', padding: '2px 8px', borderRadius: 6 }}>Booked via Timeful</div>
              </div>
            </div>
            {[
              { icon: <IcCalendar />, val: `${WEEK_DAYS[selectedEvent.day]}, May ${WEEK_DATES[selectedEvent.day]}` },
              { icon: <IcClock />,    val: `${selectedEvent.startHour < 12 ? selectedEvent.startHour : selectedEvent.startHour - 12}:${String(selectedEvent.startMin).padStart(2, '0')}${selectedEvent.startHour < 12 ? 'am' : 'pm'} · ${selectedEvent.durationMins} min` },
              { icon: <IcUsers />,    val: `${selectedEvent.people.length} participants` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                <div style={{ color: '#00BFA5' }}>{row.icon}</div>
                <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{row.val}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '11px', fontSize: 13 }} onClick={() => setSelectedEvent(null)}>Close</button>
              <button className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 13 }} onClick={() => setSelectedEvent(null)}>View event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
