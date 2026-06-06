import { motion } from "framer-motion";
import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "title", label: "회사 / 소속", required: true, placeholder: "예: (주)그원" },
  { name: "position", label: "직무 / 직책", placeholder: "예: 백엔드 엔지니어 인턴" },
  { name: "period", label: "기간", placeholder: "예: 2025.07 – 2025.12" },
  { name: "description", label: "주요 업무", type: "textarea", span: true, placeholder: "담당 업무, 성과 등" },
];

export default function CareerPage() {
  const { items, loading, error, create, remove } = useResource("careers");
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
        <div className="records">
          {items.map((c, i) => (
            <motion.article
              key={c.id}
              className="record"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              {isAdmin && (
                <button className="record__del" onClick={() => remove(c.id)} aria-label="삭제">
                  ✕
                </button>
              )}
              <div className="record__row">
                <span className="record__title">{c.title}</span>
                {c.position && <span className="record__tag">{c.position}</span>}
              </div>
              <div className="record__meta">
                {c.period && <span><b>기간</b>{c.period}</span>}
              </div>
              {c.description && <p className="record__desc">{c.description}</p>}
            </motion.article>
          ))}
        </div>
      )}
    </SectionLayout>
  );
}
