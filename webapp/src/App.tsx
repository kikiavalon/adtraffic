import { Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat.js';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Chat />} />
    </Routes>
  );
}

export default App;
