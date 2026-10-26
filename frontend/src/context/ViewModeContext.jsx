import { createContext, useContext, useState } from "react";

/**
 * viewAsUser: true  = 보기 모드 (방문자와 같은 화면). 새로고침하면 항상 이 값으로 시작한다(저장하지 않음).
 *             false = 슈퍼관리자가 홈에서 명시한 수정 모드. canEdit = isSuperAdmin && !viewAsUser.
 * editMode:   viewAsUser 의 반대. 구 포트폴리오 페이지의 라디오와 같은 플래그를 쓴다.
 */
const ViewModeContext = createContext({
  viewAsUser: true,
  setViewAsUser: () => {},
  editMode: false,
  setEditMode: () => {},
});

export function ViewModeProvider({ children }) {
  const [viewAsUser, setViewAsUser] = useState(true);
  const setEditMode = (on) => setViewAsUser(!on);
  return (
    <ViewModeContext.Provider
      value={{ viewAsUser, setViewAsUser, editMode: !viewAsUser, setEditMode }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
