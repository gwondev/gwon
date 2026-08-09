import { createContext, useContext, useState } from "react";

// 관리자가 "사용자 시점"으로 미리보기 할 수 있는 전역 토글 (자격증·활동 등에서 사용)
const ViewModeContext = createContext({ viewAsUser: false, setViewAsUser: () => {} });

export function ViewModeProvider({ children }) {
  const [viewAsUser, setViewAsUser] = useState(false);
  return (
    <ViewModeContext.Provider value={{ viewAsUser, setViewAsUser }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
