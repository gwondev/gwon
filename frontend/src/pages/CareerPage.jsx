import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";
import { useViewMode } from "../context/ViewModeContext";
import { mediaCoverImage } from "../lib/media";

const FIELDS = [
  { name: "title", label: "회사 / 소속", required: true, placeholder: "예: (주)그원" },
  { name: "category", label: "구분", type: "select-other", options: ["인턴", "계약직", "정규직"] },
  { name: "position", label: "직무 / 직책", placeholder: "예: 백엔드 엔지니어" },
  { name: "period", label: "기간", type: "period-ymd" },
  { name: "description", label: "주요 업무", type: "textarea", span: true, placeholder: "담당 업무, 성과 등 (클릭 시 팝업으로 표시)" },
  { name: "media", label: "사진·영상 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

// 버블(격자): 사진 · 회사명(크게)+구분(옆에 노랗게) · 재직기간(아래, 작게)
function renderBubble(c) {
  const img = mediaCoverImage(c.media);
  const category = c.category && c.category.trim();
  return (
    <>
      {img && <img className="certbubble__logo certbubble__logo--photo" src={img} alt="" />}
      <div className="certbubble__body">
        <span className="certbubble__nameline">
          <span className="certbubble__name">{c.title}</span>
          {category && <span className="certbubble__score">{category}</span>}
        </span>
        {c.period && <span className="certbubble__issuer">{c.period}</span>}
      </div>
    </>
  );
}

function renderDetail(c) {
  const category = c.category && c.category.trim();
  return (
    <>
      <div className="record__head">
        <span className="record__title">
          {c.title}
          {category && <span className="record__title-score"> {category}</span>}
        </span>
      </div>
      <div className="record__meta">
        {c.position && <span><b>직무</b>{c.position}</span>}
        {c.period && <span><b>기간</b>{c.period}</span>}
      </div>
      {c.description && <p className="record__desc">{c.description}</p>}
    </>
  );
}

export default function CareerPage() {
  const { items, loading, error, create, update, remove, reorder } = useResource("careers");
  const { isAdmin } = useAuth();
  const { viewAsUser } = useViewMode();

  const manageMode = isAdmin && !viewAsUser;

  return (
    <SectionLayout active="career" title="경력" sub="Career" count={items.length} showPageHint>
      {manageMode && <Adder label="경력 추가" fields={FIELDS} onCreate={create} />}

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 경력이 없습니다.</div>
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
