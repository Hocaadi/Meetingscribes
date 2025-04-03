import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import reportWebVitals from './reportWebVitals';

// Enable smooth scrolling behavior
document.documentElement.style.scrollBehavior = 'smooth';

// Dynamically set favicon based on logo
const setFavicon = () => {
  const faviconLink = document.querySelector("link[rel='icon']");
  if (faviconLink) {
    // We'll use our logo as a favicon
    faviconLink.href = '/logo.png';
  } else {
    // If no favicon link exists, create one
    const newFavicon = document.createElement('link');
    newFavicon.rel = 'icon';
    newFavicon.href = '/logo.png';
    document.head.appendChild(newFavicon);
  }
};

// Call this function right away
setFavicon();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
