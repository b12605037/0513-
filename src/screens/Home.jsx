import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { IcPlus } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);

  return (
    <div className="app-container" style={{ height: '100vh', background: '#fff' }}>
      <StatusBar />

      {/* Top bar */}
      <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#111', letterSpacing: '-0.04em' }}>meetime</span>
        {user ? (
          <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {user.picture
              ? <img src={user.picture} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: '50%', display: 'block' }} alt="" />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#555' }}>{(user.name || user.email || '?')[0].toUpperCase()}</div>
            }
          </button>
        ) : (
          <button onClick={() => navigate('/signin')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
        )}
      </div>

      {/* Centered button */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => navigate('/create')}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 140, height: 140,
            borderRadius: '50%',
            background: '#fff',
            border: '1.5px solid #E0E0E0',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer', color: '#111',
            boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.2s, transform 0.15s',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            fontFamily: 'inherit',
          }}
        >
          <IcPlus size={28} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>New Event</span>
        </button>
      </div>
    </div>
  );
}
