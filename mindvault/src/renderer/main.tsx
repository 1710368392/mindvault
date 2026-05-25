import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/components/sticky-card.css';
import './styles/components/animations.css';
import './styles/components/ant-progress.css';
import './styles/components/ant-modal.css';
import './styles/components/ant-drawer.css';
import './styles/components/ant-tree.css';
import './styles/components/ant-timeline.css';
import './styles/components/ant-table.css';
import './styles/components/ant-segmented.css';
import './styles/components/ant-image.css';
import './styles/components/ant-descriptions.css';
import './styles/components/ant-carousel.css';
import './styles/components/ant-badge.css';
import './styles/components/ant-rate.css';
import './styles/components/ant-input-number.css';
import './styles/components/ant-form.css';
import './styles/components/ant-auto-complete.css';
import './styles/components/ant-menu.css';
import './styles/components/ant-dropdown.css';
import './styles/components/ant-splitter.css';
import './styles/components/ant-button.css';
import './styles/components/ant-alert.css';
import './styles/components/ant-anchor.css';
import './styles/components/ant-card.css';
import './styles/components/ant-checkbox.css';
import './styles/components/ant-collapse.css';
import './styles/components/ant-color-picker.css';
import './styles/components/ant-empty.css';
import './styles/components/ant-float-button.css';
import './styles/components/ant-input.css';
import './styles/components/ant-message.css';
import './styles/components/ant-notification.css';
import './styles/components/ant-pagination.css';
import './styles/components/ant-popover.css';
import './styles/components/ant-select.css';
import './styles/components/ant-statistic.css';
import './styles/components/ant-switch.css';
import './styles/components/ant-tag.css';
import './styles/components/ant-tooltip.css';
import './styles/components/ant-typography.css';

document.documentElement.setAttribute('data-custom-cursor', 'false');

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key: string, value: string) => {
  originalSetItem(key, value);
  if (key === 'mindvault-custom-cursor') {
    document.documentElement.setAttribute('data-custom-cursor', value === 'true' ? 'true' : 'false');
  }
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
