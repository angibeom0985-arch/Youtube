
import React from 'react';
import './src/index.css';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import ImageApp from './image/App';
import ImageErrorBoundary from './image/components/ErrorBoundary';
import HomePage from './pages/HomePage.tsx';
import GuidePage from './pages/GuidePage.tsx';
import ApiGuidePage from './pages/ApiGuidePage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import DebugPage from './pages/DebugPage.tsx';
import DownloadProgressPage from './pages/DownloadProgressPage.tsx';
import DownloadPage from './pages/DownloadPage.tsx';
import TtsPage from './pages/TtsPage.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/script" element={<App />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/api-guide" element={<ApiGuidePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/debug" element={<Navigate to="/" replace />} />
        <Route path="/debug/" element={<Navigate to="/" replace />} />
        <Route path="/debug/script" element={<Navigate to="/script" replace />} />
        <Route path="/debug/image/*" element={<Navigate to="/image" replace />} />
        <Route path="/debug/tts" element={<Navigate to="/tts" replace />} />
        <Route path="/download-progress" element={<DownloadProgressPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/tts" element={<TtsPage />} />
        <Route
          path="/image/*"
          element={
            <ImageErrorBoundary>
              <ImageApp basePath="/image" />
            </ImageErrorBoundary>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
