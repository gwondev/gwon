// src/App.js
import { Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, Container, Typography, Grid } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";

import theme from "./theme";
import AwardsPages from "./MenuPages/AwardsPages";
import CertificationPages from "./MenuPages/CertificationPages";
import ExperiencePages from "./MenuPages/ExperiencePages";
import TechPages from "./MenuPages/TechPages";




import MenuCard from "./Components/MenuCard";



function Home() {
  return (
    <>
      {/* 헤더 */}
      <Box
        sx={{
          py: { xs: 7, md: 10 },
          textAlign: "center",
          bgcolor: "background.default",
          backgroundImage: "linear-gradient(180deg, rgba(91,140,255,.08), transparent 240px)",
        }}
      >
        <Container maxWidth="sm">
          <Typography
            variant="h3"
            fontWeight={900}
            letterSpacing={1}
            sx={{
              mb: 1,
              background: "linear-gradient(90deg, #5b8cff 40%, #39e6b5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              display: "inline-block",
            }}
          >
            이성권
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
            조선대학교 컴퓨터공학과
          </Typography>
        </Container>
      </Box>

      {/* 카드 그리드 */}
      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>

        <Grid container spacing={4} justifyContent="center" alignItems="stretch" sx={{ mt: { xs: 0, md: -8 } }}>
          <Grid>
            <MenuCard
              title="기술스택"
              
              items={[
                { head: "DEP | Docker, Github Actions, Caddy", detail: "컨테이너화, CI/CD, 리버스 프록시, SSL" },
                { head: "WEB | React, Spring Boot", detail: "컴포넌트 설계, 상태관리, 라우팅, SPA, " },
                { head: "BN | Spring Boot", detail: "REST API, JPA/ORM, 보안 설정" },
                { head: "DB | MySQL", detail: "ERD 설계, 인덱스/정규화" },
                { head: "CLOUD | AWS", detail: "EC2, SSH, 보안그룹" },
              ]}
              to="/tech"
            />
          </Grid>

          <Grid>
            <MenuCard
              title="프로젝트/활동/경력"
             
             items={[
                { head: "호남 ICT 팀빌딩 6기 [팀장]", detail: "2025.06~2025.11 호남개발자 지원사업" },
                { head: "SOS Jump [멘토]", detail: "2024.09~2024.11 전공 파이썬 멘토" },
                { head: "한국농산업인증원 [인턴]", detail: "2023.07~2023.09 사무업무 인턴" },
              ]}
              to="/experience"
            />
          </Grid>

          <Grid>
            <MenuCard
              title="수상이력"
           
              items={[
                { head: "디지털신기술아이디어공모전 우수상 [팀장]", detail: "2025.07 정보통신기획원" },
                { head: "학습성공스토리 에세이 공모전 금상", detail: "2025.08 조선대학교" },
              ]}
              to="/awards"
            />
          </Grid>

          <Grid>
            <MenuCard
              title="자격증"
             
              items={[
                { head: "컴퓨터활용능력 1급", detail: "대한상공회의소" },
                { head: "정보기기운용기능사", detail: "한국산업인력공단" },
                { head: "정보처리기능사", detail: "한국산업인력공단" },
                { head: "TOPCIT 수준 3", detail: "정보통신산업진흥원" },
              ]}
              to="/certifications"
            />
          </Grid>

          
        </Grid>
      </Container>
        <Typography variant="body1" color="text.secondary" align="center">
          <EmailIcon fontSize="small" sx={{ mr: 1 }} />
            gwondev0323@gmail.com <br />
            <GitHubIcon fontSize="small" sx={{ mr: 1 }} />
            https://github.com/gwondev
        </Typography>
    </>
  );
}

export default function App() {


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/awards" element={<AwardsPages />} />
        <Route path="/certifications" element={<CertificationPages />} />
        <Route path="/experience" element={<ExperiencePages />} />
        <Route path="/tech" element={<TechPages />} />
        <Route path="*" element={<Box sx={{ p: 4 }}>Not Found</Box>} />
      </Routes>
    </ThemeProvider>
  );
}