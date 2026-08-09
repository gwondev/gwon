import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";
import { useViewMode } from "../context/ViewModeContext";

const FIELDS = [
  { name: "title", label: "자격증명", required: true, placeholder: "예: 정보처리기사" },
  { name: "issuer", label: "발급기관", placeholder: "예: 한국산업인력공단" },
  { name: "acquired", label: "취득일", type: "ymd" },
  { name: "score", label: "등급 / 점수", placeholder: "예: 합격 / 920점 (비우면 표시 안 함)" },
  { name: "description", label: "비고", type: "textarea", span: true, placeholder: "관련 내용 (클릭 시 팝업으로 표시)" },
  { name: "logo", label: "발급처 로고 이미지 (버블에 표시)", type: "image", span: true },
  { name: "media", label: "사진·영상 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

// 버블(격자) 화면에 보이는 내용: 로고 · 자격증명(크게)+등급/점수(옆에 노랗게) · 발급처(아래, 작게)
function renderBubble(c) {
  const score = c.score && c.score.trim();
  return (
    <>
      {c.logo && <img className="certbubble__logo" src={c.logo} alt="" />}
      <div className="certbubble__body">
        <span className="certbubble__nameline">
          <span className="certbubble__name">{c.title}</span>
          {score && <span className="certbubble__score">{score}</span>}
        </span>
        {c.issuer && <span className="certbubble__issuer">{c.issuer}</span>}
      </div>
    </>
  );
}

// 클릭 시 팝업에 보이는 상세 내용 (비고 포함)
function renderDetail(c) {
  const score = c.score && c.score.trim();
  return (
    <>
      <div className="record__head">
        <span className="record__title">
          {c.title}
          {score && <span className="record__title-score"> {score}</span>}
        </span>
      </div>
      <div className="record__meta">
        {c.issuer && <span><b>발급</b>{c.issuer}</span>}
        {c.acquired && <span><b>취득</b>{c.acquired}</span>}
      </div>
      {c.description && <p className="record__desc">{c.description}</p>}
    </>
  );
}

export default function CertificationsPage() {
  const { items, loading, error, create, update, remove, reorder } = useResource("certifications");
  const { isAdmin } = useAuth();
  const { viewAsUser } = useViewMode();

  const manageMode = isAdmin && !viewAsUser;

  return (
    <SectionLayout active="certifications" title="자격증" sub="Certifications" count={items.length} showPageHint>
      {manageMode && <Adder label="자격증 추가" fields={FIELDS} onCreate={create} />}

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 자격증이 없습니다.</div>
      ) : (
        <RecordList
          items={items}
          fields={FIELDS}
          isAdmin={manageMode}
          layout="bubble"
          onUpdate={update}
          onRemove={remove}
          onReorder={reorder}
          renderItem={renderBubble}
          renderDetail={renderDetail}
        />
      )}
    </SectionLayout>
  );
}
