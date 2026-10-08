import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import './index.css';
import './components/rentals/Rentals.css';
import './pages/customer/Checkout.css';
import './pages/customer/CheckoutMobile.css';
import './components/rentals/RentalAdmin.css';
import './components/rentals/RentalShopping.css';
import './components/admin/ProductSmartFill.css';
import './components/admin/ImageBackgroundEditor.css';
import './styles/websiteCustomization.css';
import './styles/applicationTheme.css';
import './styles/formControls.css';
import App from './App.jsx';
import { store } from './store/store';

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/sw.js`).then((registration) => {
      const announceUpdate = () => window.dispatchEvent(new CustomEvent('samira:pwa-update', { detail: { registration } }));
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
        });
      });
    }).catch(() => null);
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
