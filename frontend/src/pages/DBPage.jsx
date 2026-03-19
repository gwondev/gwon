import { Box, Typography, Button, Container } from "@mui/material";
import { useNavigate } from "react-router-dom";

const DBPage = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: 2
      }}>
        <Typography variant="h3" color="primary" fontWeight="800">
          DB 페이지입니다~~
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/')}>
          뒤로 가기
        </Button>
      </Box>
    </Container>
  );
};

export default DBPage;