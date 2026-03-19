import { Box, Typography, Button, Container } from "@mui/material";
import { useNavigate } from "react-router-dom";

const RootPage = () => {
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
        {/* 여기서 'Main'이라고 썼던 부분을 'Root Page' 같은 텍스트로 바꾸세요 */}
        <Typography variant="h2" fontWeight="bold">GWON Page</Typography>
        <Typography color="text.secondary">정상적으로 연결되었습니다!</Typography>
        
        <Button variant="contained" onClick={() => navigate('/db')}>
          DB 페이지로 이동
        </Button>
      </Box>
    </Container>
  );
};

export default RootPage; 