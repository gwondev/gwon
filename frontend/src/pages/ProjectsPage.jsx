import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordItem from "../components/RecordItem";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";
import { PROJECT_CATEGORIES } from "../lib/sections";

const FIELDS = [
  { name: "title", label: "프로젝트명", required: true, placeholder: "예: 스마트팜 모니터링" },
  { name: "category", label: "분류", type: "select", options: PROJECT_CATEGORIES },
  { name: "host", label: "주관처", placeholder: "예: 한국정보산업연합회" },
  { name: "team_name", label: "팀명", placeholder: "예: 팀 GWON" },
  { name: "members", label: "팀원", span: true, placeholder: "예: 이성권, 홍길동, 김철수" },
  { name: "award", label: "수상 / 결과", placeholder: "예: 대상 (1위)" },
  { name: "period", label: "기간", type: "period" },
  { name: "description", label: "설명", type: "textarea", span: true, placeholder: "프로젝트 개요, 역할, 기술 스택 등" },
];

export default function ProjectsPage() {
  const { items, loading, error, create, update, remove } = useResource("projects");
  const { isAdmin } = useAuth();

  return (
    <SectionLayout
      active="projects"
      title="프로젝트 & 공모전"
      sub="Projects & Competitions"
      count={items.length}
    >
      <Adder label="프로젝트 추가" fields={FIELDS} onCreate={create} />

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 프로젝트가 없습니다.</div>
      ) : (
        <div className="records">
          {items.map((p, i) => (
            <RecordItem
              key={p.id}
              item={p}
              fields={FIELDS}
              index={i}
              isAdmin={isAdmin}
              onUpdate={update}
              onRemove={remove}
            >
              <div className="record__head">
                <span className="record__title">{p.title}</span>
                {p.category && <span className="record__tag">{p.category}</span>}
              </div>
              <div className="record__meta">
                {p.host && <span><b>주관처</b>{p.host}</span>}
                {p.team_name && <span><b>팀명</b>{p.team_name}</span>}
                {p.members && <span><b>팀원</b>{p.members}</span>}
                {p.award && <span><b>결과</b>{p.award}</span>}
                {p.period && <span><b>기간</b>{p.period}</span>}
              </div>
              {p.description && <p className="record__desc">{p.description}</p>}
            </RecordItem>
          ))}
        </div>
      )}
    </SectionLayout>
  );
}
