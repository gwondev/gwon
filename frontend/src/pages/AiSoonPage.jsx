import { Link } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import "./AiSoonPage.css";

export default function AiSoonPage() {
  return (
    <PageTransition className="page ai-soon">
      <section className="ai-soon__card">
        <p className="ai-soon__kicker">COMING SOON</p>
        <h1 className="ai-soon__title">AI 챗봇</h1>
        <p className="ai-soon__ko">개설 예정 페이지</p>
        <p className="ai-soon__body">
          별도 챗봇 채널을 준비하고 있습니다. 지금은 홈 오른쪽 위 내장 AI가
          이 사이트의 프로젝트, 자격증, 파일을 안내합니다.
        </p>
        <Link className="ai-soon__back" to="/">
          홈으로
        </Link>
      </section>
    </PageTransition>
  );
}
