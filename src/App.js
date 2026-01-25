import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnimatedRoutes from './components/AnimatedRoutes';
import CookieConsent from './components/CookieConsent';

function App() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [open, setOpen] = React.useState(false);
  const [forceAccept, setForceAccept] = React.useState(false);
  React.useEffect(() => {
    if (token) {
      fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d && d.role === 'admin') {
            setOpen(false);
            setForceAccept(false);
          } else if (d && d.cookiesAccepted) {
            localStorage.setItem('cookiesAccepted', 'true');
            setOpen(false);
            setForceAccept(false);
          } else {
            const acceptedLocal = localStorage.getItem('cookiesAccepted') === 'true';
            if (acceptedLocal) {
              fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/user/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ cookiesAccepted: true })
              })
                .then(() => {
                  localStorage.setItem('cookiesAccepted', 'true');
                  setOpen(false);
                  setForceAccept(false);
                })
                .catch(() => {
                  setOpen(true);
                  setForceAccept(true);
                });
            } else {
              setOpen(true);
              setForceAccept(true);
            }
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
    let timer = null
    async function updateLocation() {
      try {
        if (!token) return
        if (localStorage.getItem('cookiesAccepted') !== 'true') return
        const meRes = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
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
              if (a <= 30) {
                done = true
                resolve(null)
              }
            }
          }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })
          setTimeout(() => { if (!done) resolve(null) }, 6000)
        })
        try { if (watchId != null) navigator.geolocation.clearWatch(watchId) } catch {}
        if (best) {
          await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/user/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: best.lat, lon: best.lon, accuracy: best.accuracy })
          })
        }
      } catch {}
    }
    if (token && localStorage.getItem('cookiesAccepted') === 'true') {
      updateLocation()
      timer = setInterval(updateLocation, 30000)
    }
    return () => { if (timer) clearInterval(timer) }
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
