import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "title", label: "활동명", required: true, placeholder: "예: 멋쟁이사자처럼 13기" },
  { name: "organization", label: "기관 / 단체", placeholder: "예: 멋쟁이사자처럼" },
  { name: "role", label: "역할", placeholder: "예: 백엔드 리드" },
  { name: "period", label: "기간", type: "period-ymd" },
  { name: "description", label: "설명", type: "textarea", span: true, placeholder: "활동 내용, 성과 등" },
  { name: "media", label: "사진·영상 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

export default function ActivitiesPage() {
  const { items, loading, error, create, update, remove, reorder } = useResource("activities");
  const { isAdmin } = useAuth();

  return (
    <SectionLayout active="activities" title="활동" sub="Activities" count={items.length} showPageHint>
      <Adder label="활동 추가" fields={FIELDS} onCreate={create} />

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 활동이 없습니다.</div>
      ) : (
        <RecordList
          items={items}
          fields={FIELDS}
          isAdmin={isAdmin}
          onUpdate={update}
          onRemove={remove}
          onReorder={reorder}
          renderItem={(a) => (
            <>
              <div className="record__head">
                <span className="record__title">{a.title}</span>
                {a.role && <span className="record__tag">{a.role}</span>}
              </div>
              <div className="record__meta">
                {a.organization && <span><b>단체</b>{a.organization}</span>}
                {a.period && <span><b>기간</b>{a.period}</span>}
              </div>
              {a.description && <p className="record__desc">{a.description}</p>}
            </>
          )}
        />
      )}
    </SectionLayout>
  );
}
