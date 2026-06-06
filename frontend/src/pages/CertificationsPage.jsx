import { motion } from "framer-motion";
import SectionLayout from "../components/SectionLayout";
import Adder from "../components/Adder";
import { useResource } from "../lib/useResource";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "title", label: "자격증명", required: true, placeholder: "예: 정보처리기사" },
  { name: "issuer", label: "발급기관", placeholder: "예: 한국산업인력공단" },
  { name: "acquired", label: "취득일", placeholder: "예: 2025.08" },
  { name: "score", label: "등급 / 점수", placeholder: "예: 합격 / 920점" },
  { name: "description", label: "비고", type: "textarea", span: true, placeholder: "관련 내용" },
];

export default function CertificationsPage() {
  const { items, loading, error, create, remove } = useResource("certifications");
  const { isAdmin } = useAuth();

  return (
    <SectionLayout active="certifications" title="자격증" sub="Certifications" count={items.length}>
      <Adder label="자격증 추가" fields={FIELDS} onCreate={create} />

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="state">아직 등록된 자격증이 없습니다.</div>
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
                {c.score && <span className="record__tag">{c.score}</span>}
              </div>
              <div className="record__meta">
                {c.issuer && <span><b>발급</b>{c.issuer}</span>}
                {c.acquired && <span><b>취득</b>{c.acquired}</span>}
              </div>
              {c.description && <p className="record__desc">{c.description}</p>}
            </motion.article>
          ))}
        </div>
      )}
    </SectionLayout>
  );
}
