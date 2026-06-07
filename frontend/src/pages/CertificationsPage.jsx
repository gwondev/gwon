import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "title", label: "자격증명", required: true, placeholder: "예: 정보처리기사" },
  { name: "issuer", label: "발급기관", placeholder: "예: 한국산업인력공단" },
  { name: "acquired", label: "취득일", type: "ymd" },
  { name: "score", label: "등급 / 점수", placeholder: "예: 합격 / 920점" },
  { name: "description", label: "비고", type: "textarea", span: true, placeholder: "관련 내용" },
  { name: "media", label: "사진 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

export default function CertificationsPage() {
  const { items, loading, error, create, update, remove, reorder } = useResource("certifications");
  const { isAdmin } = useAuth();

  return (
    <SectionLayout active="certifications" title="자격증" sub="Certifications" count={items.length} showPageHint>
      <Adder label="자격증 추가" fields={FIELDS} onCreate={create} />

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
          isAdmin={isAdmin}
          onUpdate={update}
          onRemove={remove}
          onReorder={reorder}
          renderItem={(c) => (
            <>
              <div className="record__head">
                <span className="record__title">{c.title}</span>
                {c.score && <span className="record__tag">{c.score}</span>}
              </div>
              <div className="record__meta">
                {c.issuer && <span><b>발급</b>{c.issuer}</span>}
                {c.acquired && <span><b>취득</b>{c.acquired}</span>}
              </div>
              {c.description && <p className="record__desc">{c.description}</p>}
            </>
          )}
        />
      )}
    </SectionLayout>
  );
}
