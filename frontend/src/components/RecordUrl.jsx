import { normalizeUrl } from "../lib/url";
import GitHubIcon from "./GitHubIcon";

export default function RecordUrl({ url, githubUrl }) {
  const site = String(url || "").trim();
  const github = String(githubUrl || "").trim();
  if (!site && !github) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <p className="record__url">
      {site && (
        <span className="record__url-part">
          <b>접속주소</b>
          <a href={normalizeUrl(site)} target="_blank" rel="noopener noreferrer" onClick={stop}>
            {site}
          </a>
        </span>
      )}
      {github && (
        <span className="record__url-part record__url-part--github">
          <b>깃허브</b>
          <a
            href={normalizeUrl(github)}
            target="_blank"
            rel="noopener noreferrer"
            className="record__github-link"
            aria-label="GitHub 저장소 열기"
            onClick={stop}
          >
            <GitHubIcon />
          </a>
        </span>
      )}
    </p>
  );
}
