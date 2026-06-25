import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import RecordList from "../components/RecordList";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";
import { PROJECT_CATEGORIES, isProjectRecord } from "../lib/sections";
import { splitTags } from "../lib/media";
import RecordUrl from "../components/RecordUrl";
import { formatProjectHeadline } from "../lib/format";

const FIELDS = [
  { name: "title", label: "주제명", required: true, placeholder: "예: 실시간이동관리시스템" },
  { name: "category", label: "분류 (여러 개 선택 가능)", type: "multiselect", span: true, options: PROJECT_CATEGORIES },
  {
    name: "home_featured",
    label: "메인 포트폴리오 노출",
    type: "checkbox",
    span: true,
    hint: "메인 페이지에는 대표 프로젝트 2개만 노출됩니다. 가장 메인이 되는 프로젝트부터 선택해 주세요.",
  },
  { name: "host", label: "주관처", placeholder: "예: 교내 캡스톤" },
  { name: "team_name", label: "팀명", placeholder: "예: 팀 GWON" },
  { name: "members", label: "팀원", span: true, placeholder: "예: 이성권, 홍길동, 김철수" },
  { name: "period", label: "기간", type: "period-ymd" },
  { name: "url", label: "접속주소", placeholder: "예: https://devsign.co.kr", span: true },
  { name: "github_url", label: "깃허브 주소", placeholder: "예: https://github.com/username/repo", span: true },
  { name: "description", label: "설명", type: "textarea", span: true, placeholder: "프로젝트 개요, 역할, 기술 스택 등" },
  { name: "media", label: "사진·영상 + 설명 (클릭 시 팝업으로 표시)", type: "media", span: true },
];

export default function ProjectsPage() {
  const { items: all, loading, error, create, update, remove, reorder } = useResource("projects");
  const { isAdmin } = useAuth();
  const items = all.filter(isProjectRecord);

  return (
    <SectionLayout
      active="projects"
      title="프로젝트"
      sub="Projects"
      count={items.length}
      showPageHint
    >
      <Adder label="프로젝트 추가" fields={FIELDS} onCreate={create} />

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 프로젝트가 없습니다.</div>
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
                <span className="record__title">{formatProjectHeadline(p)}</span>
                {splitTags(p.category).map((c) => (
                  <span className="record__tag" key={c}>
                    {c}
                  </span>
                ))}
              </div>
              <div className="record__meta">
                {p.host && <span><b>주관처</b>{p.host}</span>}
                {p.title && <span><b>주제명</b>{p.title}</span>}
                {p.members && <span><b>팀원</b>{p.members}</span>}
                {p.period && <span><b>기간</b>{p.period}</span>}
              </div>
              <RecordUrl url={p.url} githubUrl={p.github_url} />
              {p.description && <p className="record__desc">{p.description}</p>}
            </>
          )}
        />
      )}
    </SectionLayout>
  );
}
