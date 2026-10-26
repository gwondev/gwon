import { Navigate, useSearchParams } from "react-router-dom";

export default function MyPage() {
  const [params] = useSearchParams();
  const tab = params.get("tab");
  return <Navigate to={tab ? `/admin?tab=${tab}` : "/admin"} replace />;
}
