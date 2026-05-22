import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { IcClock, IcUsers, IcGoogle } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await res.json();
        signIn(userInfo);
        navigate('/');
      } catch {
        setError('登入失敗，請再試一次。');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setLoading(false);
      setError('Google 登入失敗，請再試一次。');
    },
  });

  return (
    <div className="app-container">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>

        {/* Invite card */}
        <div style={{ background: 'linear-gradient(135deg,#8A9DA8,#8A9DA8)', borderRadius: 20, padding: 24, marginTop: 24, marginBottom: 28, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>你收到邀請</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Q2 Planning Kickoff</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, opacity: 0.85 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IcClock /> 60 分鐘</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IcUsers /> 5 人</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>請在 5/9 前回覆 · PST</div>
          <div className="avatar-stack" style={{ marginTop: 14 }}>
            {['A', 'S', 'J', 'R'].map((l, i) => (
              <div key={i} className="avatar" style={{ background: 'rgba(255,255,255,0.3)', color: '#fff', border: '2px solid rgba(255,255,255,0.5)', width: 28, height: 28, fontSize: 11 }}>{l}</div>
            ))}
            <div className="avatar" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.3)', width: 28, height: 28, fontSize: 11 }}>+1</div>
          </div>
        </div>

        {/* Primary action */}
        <button className="btn-primary" onClick={() => navigate('/grid')} style={{ marginBottom: 16 }}>
          填寫我的可用時間
        </button>

        {/* Optional Google Calendar */}
        <div style={{ background: '#F8FFFE', border: '1.5px solid #E0F5F2', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            自動偵測空閒時段
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#8A9DA8', background: '#E0F5F2', borderRadius: 6, padding: '2px 7px' }}>選填</span>
          </div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 14 }}>
            連結 Google 日曆，自動標記你的空閒時段。
          </div>
          <button className="btn-google" onClick={() => { setLoading(true); handleGoogle(); }} style={{ width: '100%' }} disabled={loading}>
            {loading
              ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <><IcGoogle /> 以 Google 帳號繼續</>
            }
          </button>
          {error && <div style={{ fontSize: 12, color: '#E53935', marginTop: 10, textAlign: 'center' }}>{error}</div>}
        </div>

        <div style={{ fontSize: 11, color: '#CCC', textAlign: 'center', lineHeight: 1.6, marginTop: 16 }}>
          meetime 僅讀取你的行事曆空閒狀態，不會存取任何活動內容。
        </div>
      </div>
    </div>
  );
}
