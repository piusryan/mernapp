import React from 'react';
import './App.css';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnimatedRoutes from './components/AnimatedRoutes';
import CookieConsent from './components/CookieConsent';
import { API_BASE } from './api';

function App() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [open, setOpen] = React.useState(false);
  const [forceAccept, setForceAccept] = React.useState(false);
  React.useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d && d.role === 'admin') {
            setOpen(false);
            setForceAccept(false);
            return;
          }
          const hasLocation = d && d.location && (d.location.lat != null || d.location.lon != null);
          if (hasLocation) {
            localStorage.setItem('cookiesAccepted', 'true');
            setOpen(false);
            setForceAccept(false);
          } else {
            setOpen(true);
            setForceAccept(true);
          }
        })
        .catch(() => { setOpen(true); setForceAccept(true) });
    } else {
      const isAdminLogin = typeof window !== 'undefined' && window.location && window.location.pathname === '/login' && localStorage.getItem('adminLoginIntent') === 'true';
      const accepted = localStorage.getItem('cookiesAccepted') === 'true';
      if (isAdminLogin) {
        setOpen(false);
        setForceAccept(false);
      } else if (accepted) {
        setOpen(false);
        setForceAccept(false);
      } else {
        setOpen(true);
        setForceAccept(true);
      }
    }
  }, [token]);
  React.useEffect(() => {
    async function updateLocation() {
      try {
        if (!token) return
        if (localStorage.getItem('cookiesAccepted') !== 'true') return
        
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        const me = await meRes.json()
        if (!meRes.ok) return
        if (me && me.role === 'admin') return
        if (!('geolocation' in navigator)) return
        
        let best = null
        let watchId = null
        await new Promise((resolve) => {
          let done = false
          watchId = navigator.geolocation.watchPosition((pos) => {
            const a = pos.coords.accuracy || 9999
            if (!best || a < best.accuracy) {
              best = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: a }
              if (a <= 50) {
                done = true
                resolve(null)
              }
            }
          }, () => {}, { enableHighAccuracy: true, timeout: 180000, maximumAge: 0 })
          setTimeout(() => { if (!done) resolve(null) }, 60000)
        })
        try { if (watchId != null) navigator.geolocation.clearWatch(watchId) } catch {}
        
        // Fallback to single shot if watch timed out without result
        if (!best) {
          try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 30000 }))
            best = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }
          } catch {}
        }

        if (best) {
          // Automatic Reverse Geocoding
          let address = ''
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${best.lat}&lon=${best.lon}&zoom=18&addressdetails=1`)
            const j = await res.json()
            address = (j && (j.display_name || (j.address && Object.values(j.address).join(', ')))) || ''
          } catch {}

          await fetch(`${API_BASE}/api/user/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
              lat: best.lat, 
              lon: best.lon, 
              accuracy: best.accuracy, 
              source: 'GPS',
              landmark: address // Send address to be saved in MongoDB
            })
          })
        }
      } catch {}
    }

    updateLocation()
    const interval = setInterval(updateLocation, 120000) // 120 seconds interval
    return () => clearInterval(interval)
  }, [token])
  return (
    <BrowserRouter>
      <Navbar />
      <AnimatedRoutes />
      {open && <CookieConsent onClose={()=>setOpen(false)} forceAccept={forceAccept} />}
    </BrowserRouter>
  );
}

export default App;
