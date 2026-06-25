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

const PREVIEW_LIMIT = 3;

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function joinMeta(parts) {
  return parts.filter(Boolean).join(" · ");
}

function OverviewSection({ section, countLabel, children }) {
  return (
    <section className="ov-section">
      <header className="ov-section__head">
        <h2 className="ov-section__title">{section.title}</h2>
        {countLabel ? <span className="ov-section__count">{countLabel}</span> : null}
      </header>
      <div className="ov-section__body">{children}</div>
    </section>
  );
}

function CompactLine({ main, meta, tag }) {
  return (
    <p className="ov-line">
      <span className="ov-line__main">{main}</span>
      {tag ? (
        <>
          {" · "}
          <span className="ov-line__tag">{tag}</span>
        </>
      ) : null}
      {meta ? (
        <>
          {" · "}
          <span className="ov-line__meta">{meta}</span>
        </>
      ) : null}
    </p>
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
                <CompactLine
                  key={g.group}
                  main={g.group}
                  meta={g.items.map(formatTechItemLabel).join(", ")}
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
              competitions.slice(0, PREVIEW_LIMIT).map((it) => (
                <CompactLine
                  key={it.id}
                  main={it.team_name || it.title}
                  tag={it.award || null}
                  meta={joinMeta([splitTags(it.category).join(" · "), it.period])}
                />
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
              projectList.slice(0, PREVIEW_LIMIT).map((it) => (
                <CompactLine
                  key={it.id}
                  main={it.team_name || it.title}
                  tag={splitTags(it.category)[0] || null}
                  meta={joinMeta([it.host, it.period])}
                />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.activities}
            countLabel={activities.length ? `${activities.length}건` : null}
          >
            {activities.length ? (
              activities.slice(0, PREVIEW_LIMIT).map((it) => (
                <CompactLine
                  key={it.id}
                  main={it.title}
                  tag={it.role || null}
                  meta={joinMeta([it.organization, it.period])}
                />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.certifications}
            countLabel={certifications.length ? `${certifications.length}건` : null}
          >
            {certifications.length ? (
              certifications.slice(0, PREVIEW_LIMIT).map((it) => (
                <CompactLine
                  key={it.id}
                  main={it.title}
                  tag={it.score || null}
                  meta={joinMeta([it.issuer, it.acquired])}
                />
              ))
            ) : (
              <EmptyNote />
            )}
          </OverviewSection>

          <OverviewSection
            section={sectionMap.career}
            countLabel={career.length ? `${career.length}건` : null}
          >
            {career.length ? (
              career.slice(0, PREVIEW_LIMIT).map((it) => (
                <CompactLine
                  key={it.id}
                  main={it.title}
                  tag={it.category || null}
                  meta={joinMeta([
                    it.position,
                    formatCareerPeriodPreview(it.period) || it.period,
                  ])}
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
