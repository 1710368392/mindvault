import React from 'react';
import ReactDOM from 'react-dom/client';
import FullscreenVisualizer from './components/music/FullscreenVisualizer';

// Import styles
import './styles/globals.css';

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <FullscreenVisualizer />
    </React.StrictMode>,
  );
}
