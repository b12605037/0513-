import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('meetime_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const signIn = (userInfo) => {
    setUser(userInfo);
    localStorage.setItem('meetime_user', JSON.stringify(userInfo));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('meetime_user');
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
