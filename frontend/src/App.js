// src/App.js
import { Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, Container, Typography, Grid } from "@mui/material";
import { Caption1 } from "./styles/typography";


import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";


import theme from "./theme";
import AwardsPages from "./MenuPages/AwardsPages";
import CertificationPages from "./MenuPages/CertificationPages";
import ExperiencePages from "./MenuPages/ExperiencePages";
import TechPages from "./MenuPages/TechPages";

//MOVE
import MovePages from "./MovePages/MoveMainPages"


//Chat Ai Route Pages





//sw중심대학창업아이디어공모전 페이지ssss
import PassPages from "./OtherPages/PassPages";
import BaseballPage from  "./OtherPages/PassButtonPages/BaseballPage";
import SoccerPage from "./OtherPages/PassButtonPages/SoccerPage";
import MoviePage from "./OtherPages/PassButtonPages/MoviePage";
import PerformancePage from "./OtherPages/PassButtonPages/PerformancePage";
import SoonPage from "./OtherPages/PassButtonPages/SoonPage";
import KiaPage from "./OtherPages/PassButtonPages/KiaPage";
import KiaSeatPage from "./OtherPages/PassButtonPages/KiaSeatPage";
import KiaSchedulePage from "./OtherPages/PassButtonPages/KiaSchedulePage";
import KiaPayPage from "./OtherPages/PassButtonPages/KiaPayPage";

//import components
import MenuCard from "./Components/MenuCard";
import HeartLike from "./Components/HeartLike";
import ChatBox from "./Components/ChatBox";

console.log("KiaPayPage:", KiaPayPage);

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
            variant="h4"
            fontWeight={800}
            lineHeight={1}
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
          <Caption1 size={18} text="조선대학교 컴퓨터공학과" />
          
          <HeartLike id={1} />
          <ChatBox />
        </Container>
      </Box>

      {/* 🧠 Chat AI 입력칸 */}
      


      {/* 카드 그리드 */}
      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>

        <Grid container spacing={4} justifyContent="center" alignItems="stretch" sx={{ mt: { xs: 0, md: -8 } }}>
          <Grid>
            <MenuCard
              title="기술스택"
              
              items={[
                { head: "LANG |  C, C++, Js, JAVA, Python", detail: "Programming Language" },
                { head: "DEPLOY | Docker, CI/CD, Caddy", detail: "컨테이너화, 배포, 리버스프록시" },
                { head: "INFRA | AWS, Proxmox", detail: "EC2,보안그룹, 가상화" },
                { head: "WEB | React, Spring Boot", detail: "컴포넌트설계, rest API" },
                { head: "DB | MySQL", detail: "ERD 설계, 쿼리 최적화" },
                
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


        <Typography variant="body1" color="text.secondary" align="center" lineHeight={1}>
          <EmailIcon fontSize="small" sx={{ mr: 1 }} />
            gwondev0323@gmail.com <br />
            <GitHubIcon fontSize="small" sx={{ mr: 1 }} />
            https://github.com/gwondev
        </Typography>
        <Box height= {100}></Box>
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
        <Route path="/move" element={<MovePages />} />


         {/* 중첩 라우팅 */}
        <Route path="/pass" element={<PassPages />} />
        <Route path="/pass/baseball" element={<BaseballPage />} />
        <Route path="/pass/soccer" element={<SoccerPage />} />
        <Route path="/pass/movie" element={<MoviePage />} />
        <Route path="/pass/performance" element={<PerformancePage />} />

        <Route path="/pass/baseball/soon" element={<SoonPage />} />
        <Route path="/pass/baseball/kia" element={<KiaPage />} />

        
        <Route path="/pass/baseball/kia/schedule" element={<KiaSchedulePage />} />
        <Route path="/pass/baseball/kia/schedule/seat" element={<KiaSeatPage />} />
        <Route path="/pass/baseball/kia/schedule/seat/pay" element={<KiaPayPage />} />



      </Routes>
    </ThemeProvider>
  );
}