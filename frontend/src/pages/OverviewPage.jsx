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

function OverviewSection({ section, countLabel, children }) {
  return (
    <section className="ov-section">
      <header className="ov-section__head">
        <h2 className="ov-section__title">{section.title}</h2>
        {countLabel ? <span className="ov-section__count">{countLabel}</span> : null}
      </header>
      <div className="ov-section__body ov-bubbles">{children}</div>
    </section>
  );
}

// 사진 없는 작은 버블 (자격증 버블을 축소한 느낌)
function OvBubble({ name, tag, sub }) {
  return (
    <div className="ov-bubble">
      <span className="ov-bubble__nameline">
        <span className="ov-bubble__name">{name}</span>
        {tag ? <span className="ov-bubble__tag">{tag}</span> : null}
      </span>
      {sub ? <span className="ov-bubble__sub">{sub}</span> : null}
    </div>
  );
}

function EmptyNote() {
  return <p className="ov-empty">—</p>;
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
  const activityList = activities;
  const certList = certifications;
  const careerList = career;

  const sectionMap = useMemo(
    () => ({
      techstack: SECTIONS.find((s) => s.key === "techstack"),
      competitions: SECTIONS.find((s) => s.key === "competitions"),
      projects: SECTIONS.find((s) => s.key === "projects"),
      activities: SECTIONS.find((s) => s.key === "activities"),
      certifications: SECTIONS.find((s) => s.key === "certifications"),
      career: SECTIONS.find((s) => s.key === "career"),
    }),
    []
  );

  return (
    <PageTransition className="page overview">
      <div className="overview__shell">
        <div className="overview__top">
          <TabNav active="overview" />
        </div>

        <motion.header
          className="overview__head"
          initial="hidden"
          animate="show"
          variants={fade}
        >
          <h1 className="overview__title">전체 포트폴리오 요약</h1>
          <p className="overview__intro">{ABOUT.intro}</p>
        </motion.header>

        <motion.div
          className="overview__sections"
          initial="hidden"
          animate="show"
          variants={fade}
        >
          <OverviewSection
            section={sectionMap.techstack}
            countLabel={techGroups.length ? `${techGroups.length}분야` : null}
          >
            {techGroups.length ? (
              techGroups.map((g) => (
                <OvBubble
                  key={g.group}
                  name={g.group}
                  sub={g.items.map(formatTechItemLabel).join(", ")}
                />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.competitions}
            countLabel={competitions.length ? `${competitions.length}건` : null}
          >
            {competitions.length ? (
              competitions.map((it) => (
                <OvBubble key={it.id} name={it.title} tag={it.award || null} sub={it.team_name || null} />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.projects}
            countLabel={projectList.length ? `${projectList.length}건` : null}
          >
            {projectList.length ? (
              projectList.map((it) => (
                <OvBubble key={it.id} name={it.title} tag={splitTags(it.category).join(" · ") || null} />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.activities}
            countLabel={activityList.length ? `${activityList.length}건` : null}
          >
            {activityList.length ? (
              activityList.map((it) => (
                <OvBubble key={it.id} name={it.title} tag={it.role || null} />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.certifications}
            countLabel={certList.length ? `${certList.length}건` : null}
          >
            {certList.length ? (
              certList.map((it) => (
                <OvBubble key={it.id} name={it.title} tag={it.score || null} />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.career}
            countLabel={careerList.length ? `${careerList.length}건` : null}
          >
            {careerList.length ? (
              careerList.map((it) => (
                <OvBubble
                  key={it.id}
                  name={it.title}
                  sub={formatCareerPeriodPreview(it.period) || it.period || null}
                />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>
        </motion.div>
      </div>
    </PageTransition>
  );
}
