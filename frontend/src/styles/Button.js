
import { Link } from "react-router-dom";
import { Button } from "@mui/material";


// 공통 버튼
export default function MenuButton({ to, label }) {
  return (
    <Button
      variant="contained"
      component={Link}
      to={to}
      disableElevation
      sx={{
        height: 100,
        width: "65%",             // 가로폭 80%
        mx: "auto",               // 가운데 정렬
        bgcolor: "background.paper",
        color: "text.primary",
        fontSize: "2.5rem",
        fontWeight: 700,
        py: 2.5,
        borderRadius: 3,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        "&:hover": {
          bgcolor: "background.paper",
          transform: "translateY(-2px)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
        },
        transition: "all .15s ease",
      }}
    >
      {label}
    </Button>
  );
}