export default function StatusBar({ dark = false }) {
  const c = dark ? '#fff' : '#111';
  return (
    <div className="status-bar">
      <span className="status-time" style={{ color: c }}>9:41</span>
      <div className="status-icons">
        <svg width="16" height="12" viewBox="0 0 16 12" fill={c}>
          <rect x="0" y="4" width="3" height="8" rx="1" opacity="0.4"/>
          <rect x="4" y="2.5" width="3" height="9.5" rx="1" opacity="0.6"/>
          <rect x="8" y="1" width="3" height="11" rx="1" opacity="0.8"/>
          <rect x="12" y="0" width="3" height="12" rx="1"/>
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={c}>
          <path d="M8 2.5C5.5 2.5 3.3 3.6 1.8 5.3L0 3.4C2 1.3 4.9 0 8 0s6 1.3 8 3.4L14.2 5.3C12.7 3.6 10.5 2.5 8 2.5z" opacity="0.4"/>
          <path d="M8 5.5c-1.8 0-3.4.8-4.5 2L2 6.2C3.4 4.8 5.6 4 8 4s4.6.8 6 2.2L12.5 7.5C11.4 6.3 9.8 5.5 8 5.5z" opacity="0.7"/>
          <circle cx="8" cy="11" r="1.5"/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke={c} strokeOpacity="0.35"/>
          <rect x="2" y="2" width="17" height="8" rx="2" fill={c}/>
          <path d="M23 4v4a2 2 0 000-4z" fill={c} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}
