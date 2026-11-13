import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startAnalytics } from './analytics';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/workshop.css';
import './styles/print.css';

startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
