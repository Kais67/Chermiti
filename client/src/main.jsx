import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import '@fontsource-variable/fraunces';import '@fontsource-variable/nunito';import './styles.css';import App from './App.jsx';
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
if('serviceWorker' in navigator){
 if(import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 else navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{}); // pas de cache périmé en développement
}
