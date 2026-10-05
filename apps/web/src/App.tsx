import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RunsProvider } from './store/runs';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { RunLayout } from './pages/RunLayout';
import { ReviewPage } from './pages/ReviewPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { VerificationPage } from './pages/VerificationPage';
import { ImplementationPage } from './pages/ImplementationPage';
import { ExamplesModal } from './components/layout/ExamplesModal';
import './App.css';

export function App() {
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);

  return (
    <RunsProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route
              path="/"
              element={<HomePage onOpenExamples={() => setIsExamplesOpen(true)} />}
            />
            <Route
              path="/new"
              element={<NewAnalysisPage onOpenExamples={() => setIsExamplesOpen(true)} />}
            />
            <Route path="/runs/:runId" element={<RunLayout />}>
              <Route index element={<ReviewPage />} />
              <Route path="architecture" element={<ArchitecturePage />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="implementation" element={<ImplementationPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>

        <ExamplesModal
          isOpen={isExamplesOpen}
          onClose={() => setIsExamplesOpen(false)}
        />
      </BrowserRouter>
    </RunsProvider>
  );
}

export default App;
