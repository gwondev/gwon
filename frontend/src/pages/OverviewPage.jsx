import { useMemo } from "react";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import TabNav from "../components/TabNav";
import { ABOUT, SECTIONS, isCompetition, isProjectRecord, TECH_STACK_FALLBACK } from "../lib/sections";
import { usePortfolioPreview } from "../lib/usePortfolioPreview";
import { useTechStack } from "../lib/useTechStack";
import { formatTechItemLabel } from "../lib/techStackDisplay";
import { formatCareerPeriodPreview } from "../lib/format";
import { splitTags } from "../lib/media";
import "./OverviewPage.css";

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// 세부페이지 버블과 동일한 카드 (사진 없이 텍스트만)
function OvBubble({ name, tag, sub }) {
  return (
    <div className="record record--bubble ov-bubble">
      <div className="certbubble__body">
        <span className="certbubble__nameline">
          <span className="certbubble__name">{name}</span>
          {tag ? <span className="certbubble__score">{tag}</span> : null}
        </span>
        {sub ? <span className="certbubble__issuer">{sub}</span> : null}
      </div>
    </div>
  );
}

function OvSection({ title, countLabel, cols, empty, children }) {
  return (
    <section className="ov-sec">
      <h2 className="ov-sec__title">
        {title}
        {countLabel ? <span className="ov-sec__count">{countLabel}</span> : null}
      </h2>
      {empty ? (
        <p className="ov-empty">—</p>
      ) : (
        <div className="records--bubble-grid" style={{ "--bubble-cols": cols }}>
          {children}
        </div>
      )}
    </section>
  );
}

export default function OverviewPage() {
  const { preview } = usePortfolioPreview();
  const projects = preview.projects;
  const activities = preview.activities;
  const certifications = preview.certifications;
  const career = preview.career;
  const { groups: techGroupsRaw } = useTechStack();
  const techGroups = techGroupsRaw.length ? techGroupsRaw : TECH_STACK_FALLBACK;

  const competitions = useMemo(() => projects.filter(isCompetition), [projects]);
  const projectList = useMemo(() => projects.filter(isProjectRecord), [projects]);

  const titleOf = (key) => SECTIONS.find((s) => s.key === key)?.title || "";

  return (
    <PageTransition className="page overview">
      <div className="overview__shell">
        <div className="overview__top">
          <TabNav active="overview" />
        </div>

        <motion.header className="overview__head" initial="hidden" animate="show" variants={fade}>
          <h1 className="overview__title">전체 포트폴리오 요약</h1>
          <p className="overview__intro">{ABOUT.intro}</p>
        </motion.header>

        <motion.div className="overview__sections" initial="hidden" animate="show" variants={fade}>
          <OvSection
            title={titleOf("techstack")}
            countLabel={techGroups.length ? `${techGroups.length}분야` : null}
            cols={5}
            empty={!techGroups.length}
          >
            {techGroups.map((g) => (
              <OvBubble key={g.group} name={g.group} sub={g.items.map(formatTechItemLabel).join(", ")} />
            ))}
          </OvSection>

          <OvSection
            title={titleOf("competitions")}
            countLabel={competitions.length ? `${competitions.length}건` : null}
            cols={4}
            empty={!competitions.length}
          >
            {competitions.map((it) => (
              <OvBubble key={it.id} name={it.title} tag={it.award || null} sub={it.team_name || null} />
            ))}
          </OvSection>

          <OvSection
            title={titleOf("projects")}
            countLabel={projectList.length ? `${projectList.length}건` : null}
            cols={3}
            empty={!projectList.length}
          >
            {projectList.map((it) => (
              <OvBubble key={it.id} name={it.title} sub={splitTags(it.category).join(" · ") || null} />
            ))}
          </OvSection>

          <OvSection
            title={titleOf("activities")}
            countLabel={activities.length ? `${activities.length}건` : null}
            cols={5}
            empty={!activities.length}
          >
            {activities.map((it) => (
              <OvBubble key={it.id} name={it.title} tag={it.role || null} />
            ))}
          </OvSection>

          <OvSection
            title={titleOf("certifications")}
            countLabel={certifications.length ? `${certifications.length}건` : null}
            cols={5}
            empty={!certifications.length}
          >
            {certifications.map((it) => (
              <OvBubble key={it.id} name={it.title} tag={it.score || null} />
            ))}
          </OvSection>

          <OvSection
            title={titleOf("career")}
            countLabel={career.length ? `${career.length}건` : null}
            cols={4}
            empty={!career.length}
          >
            {career.map((it) => (
              <OvBubble
                key={it.id}
                name={it.title}
                sub={formatCareerPeriodPreview(it.period) || it.period || null}
              />
            ))}
          </OvSection>
        </motion.div>
      </div>
    </PageTransition>
  );
}
