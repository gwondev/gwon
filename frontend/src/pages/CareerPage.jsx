import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "title", label: "회사 / 소속", required: true, placeholder: "예: (주)그원" },
  { name: "category", label: "구분", type: "select-other", options: ["인턴", "계약직", "정규직"] },
  { name: "position", label: "직무 / 직책", placeholder: "예: 백엔드 엔지니어" },
  { name: "period", label: "기간", type: "period-ymd" },
  { name: "description", label: "주요 업무", type: "textarea", span: true, placeholder: "담당 업무, 성과 등" },
  { name: "media", label: "사진 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

export default function CareerPage() {
  const { items, loading, error, create, update, remove, reorder } = useResource("careers");
  const { isAdmin } = useAuth();

  return (
    <SectionLayout active="career" title="경력" sub="Career" count={items.length}>
      <Adder label="경력 추가" fields={FIELDS} onCreate={create} />

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
          isAdmin={isAdmin}
          onUpdate={update}
          onRemove={remove}
          onReorder={reorder}
          renderItem={(c) => (
            <>
              <div className="record__head">
                <span className="record__title">{c.title}</span>
                {c.category && <span className="record__tag">{c.category}</span>}
              </div>
              <div className="record__meta">
                {c.position && <span><b>직무</b>{c.position}</span>}
                {c.period && <span><b>기간</b>{c.period}</span>}
              </div>
              {c.description && <p className="record__desc">{c.description}</p>}
            </>
          )}
        />
      )}
    </SectionLayout>
  );
}
