// src/theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    body1:{ fontSize: "12px", fontWeight: 500, lineHeight: 1},
  },



  palette: {
    mode: "dark",
    background: { default: "#0b0c10", paper: "#0f1116" },
    text: { primary: "#ECEEF2", secondary: "#9AA3AE" },
    primary: { main: "#5b8cff" },
    secondary: { main: "#39e6b5" },
  },
  shape: { borderRadius: 16 },
});


export default theme;
