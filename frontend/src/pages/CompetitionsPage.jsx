import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";
import { PROJECT_CATEGORIES, isCompetition } from "../lib/sections";
import { splitTags } from "../lib/media";

const FIELDS = [
  { name: "title", label: "공모전 / 대회명", required: true, placeholder: "예: OO 해커톤" },
  { name: "category", label: "분류 (여러 개 선택 가능)", type: "multiselect", span: true, options: PROJECT_CATEGORIES },
  { name: "host", label: "주관처", placeholder: "예: 한국정보산업연합회" },
  { name: "team_name", label: "팀명", placeholder: "예: 팀 GWON" },
  { name: "members", label: "팀원", span: true, placeholder: "예: 이성권, 홍길동, 김철수" },
  { name: "award", label: "수상 / 결과", required: true, placeholder: "예: 대상 (1위)" },
  { name: "period", label: "기간", type: "period-ymd" },
  {
    name: "description",
    label: "설명",
    type: "textarea",
    span: true,
    placeholder: "공모전 개요, 역할, 성과 등",
  },
  { name: "media", label: "사진 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

export default function CompetitionsPage() {
  const { items: all, loading, error, create, update, remove, reorder } = useResource("projects");
  const { isAdmin } = useAuth();
  const items = all.filter(isCompetition);

  return (
    <SectionLayout
      active="competitions"
      title="공모전 & 수상"
      sub="Competitions & Awards"
      count={items.length}
      showPageHint
    >
      <Adder label="공모전 · 수상 추가" fields={FIELDS} onCreate={create} />

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 공모전·수상 기록이 없습니다.</div>
      ) : (
        <RecordList
          items={items}
          fields={FIELDS}
          isAdmin={isAdmin}
          onUpdate={update}
          onRemove={remove}
          onReorder={reorder}
          renderItem={(p) => (
            <>
              <div className="record__head">
                <span className="record__title">{p.title}</span>
                {splitTags(p.category).map((c) => (
                  <span className="record__tag" key={c}>
                    {c}
                  </span>
                ))}
              </div>
              <div className="record__meta">
                {p.host && (
                  <span>
                    <b>주관처</b>
                    {p.host}
                  </span>
                )}
                {p.team_name && (
                  <span>
                    <b>팀명</b>
                    {p.team_name}
                  </span>
                )}
                {p.members && (
                  <span>
                    <b>팀원</b>
                    {p.members}
                  </span>
                )}
                {p.award && (
                  <span>
                    <b>결과</b>
                    {p.award}
                  </span>
                )}
                {p.period && (
                  <span>
                    <b>기간</b>
                    {p.period}
                  </span>
                )}
              </div>
              {p.description && <p className="record__desc">{p.description}</p>}
            </>
          )}
        />
      )}
    </SectionLayout>
  );
}
