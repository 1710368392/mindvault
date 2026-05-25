import React from 'react';
import ReactDOM from 'react-dom/client';
import MusicPlayerWindow from './components/common/MusicPlayerWindow';
import './styles/globals.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <MusicPlayerWindow />
  </React.StrictMode>
);
