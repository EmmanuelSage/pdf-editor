import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import EditPdf from './pages/EditPdf';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/edit" element={<EditPdf />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
