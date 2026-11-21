import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import '@fontsource-variable/noto-sans-arabic';import '@fontsource-variable/fraunces';import '@fontsource-variable/nunito';import './styles.css';import App from './App.jsx';import {I18nProvider} from './i18n';import {EcoleGate} from './Ecole.jsx';import Plateforme from './Plateforme.jsx';
createRoot(document.getElementById('root')).render(<I18nProvider><BrowserRouter>{location.pathname.startsWith('/plateforme')?<Plateforme/>:<EcoleGate><App/></EcoleGate>}</BrowserRouter></I18nProvider>);
if('serviceWorker' in navigator&&!window.Capacitor){
 if(import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 else navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{}); // pas de cache périmé en développement
}
