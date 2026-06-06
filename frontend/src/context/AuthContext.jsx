import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "gwon_token";

// 구글 클라이언트 ID 가 주입되지 않은 환경 = 로컬 미리보기 모드.
// 실제 로그인 없이 "로컬 사용자" 로 전체 UI(관리자 화면 포함)를 확인할 수 있다.
const LOCAL_MODE = !import.meta.env.VITE_GOOGLE_CLIENT_ID;
const LOCAL_USER = {
  id: 0,
  email: "local@preview",
  name: "로컬 사용자",
  nickname: "로컬 사용자",
  picture: null,
  role: "ADMIN",
  local: true,
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(LOCAL_MODE ? LOCAL_USER : null);
  const [loading, setLoading] = useState(!LOCAL_MODE && Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (LOCAL_MODE) return;
    let alive = true;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api("/auth/me", { token })
      .then((data) => {
        if (alive) setUser(data.user);
      })
      .catch(() => {
        if (alive) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  // 구글 ID 토큰(credential) 을 우리 세션으로 교환
  const loginWithGoogle = useCallback(async (credential) => {
    const data = await api("/auth/google", {
      method: "POST",
      body: { credential },
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const updateNickname = useCallback(
    async (nickname) => {
      if (LOCAL_MODE) {
        setUser((u) => ({ ...u, nickname }));
        return { ...LOCAL_USER, nickname };
      }
      const data = await api("/auth/nickname", {
        method: "PUT",
        body: { nickname },
        token,
      });
      setUser(data.user);
      return data.user;
    },
    [token]
  );

  const logout = useCallback(() => {
    if (LOCAL_MODE) return;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    token,
    user,
    loading,
    localMode: LOCAL_MODE,
    isAuthed: Boolean(user),
    isAdmin: user?.role === "ADMIN",
    loginWithGoogle,
    updateNickname,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
