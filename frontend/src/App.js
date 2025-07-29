import { Button } from '@mui/material';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Move from 'pages/Move.js';

function HomePage() {
  const navigate = useNavigate();
  return <Button onClick={() => navigate('/Move')}>Move로 이동</Button>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/Move" element={<Move />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;