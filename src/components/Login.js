import React, { useEffect, useState } from 'react'
import '../home.css'
import { API_BASE } from '../api'
import { useNavigate } from 'react-router-dom'
// Cleaned up OAuth imports

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [adminMode, setAdminMode] = useState(false)
  const [error, setError] = useState('')
  const [promos, setPromos] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/api/items`)
      .then((r) => r.json())
      .then((arr) => setPromos(arr.map((it)=>it.imagePath).filter(Boolean).slice(0,4)))
      .catch(() => setPromos([]))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      let url = `${API_BASE}/api/auth/${mode}`
      let body = {}
      if (mode === 'login') {
        body = adminMode ? { username: 'AJadmin', password } : { email, password }
      } else {
        body = { email, password, otp }
      }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      localStorage.setItem('token', data.token)
      window.location.href = '/items'
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => {
    if (adminMode) localStorage.setItem('adminLoginIntent', 'true')
    else localStorage.removeItem('adminLoginIntent')
  }, [adminMode])

  async function requestOtp() {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'OTP request failed')
      alert('OTP sent to your email')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="overlay" onClick={() => navigate('/')}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="auth-header">
            <h2>{mode === 'login' ? 'Login' : 'Register (OTP)'}</h2>
            <div className="auth-tabs">
              <div className={mode==='login'?'auth-tab active':'auth-tab'} onClick={()=>setMode('login')}>Login</div>
              <div className={mode==='register'?'auth-tab active':'auth-tab'} onClick={()=>setMode('register')}>Sign up</div>
            </div>
          </div>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mode === 'login' ? (
              <>
                <input className="auth-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="auth-input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={adminMode} onChange={(e) => setAdminMode(e.target.checked)} />
                  <span>Admin login (AJadmin)</span>
                </div>
                <div className="auth-actions">
                  <button className="auth-btn" type="submit">Login</button>
                </div>
              </>
            ) : (
              <>
                <input className="auth-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="auth-actions">
                  <button className="auth-btn" type="button" onClick={requestOtp}>Get OTP</button>
                </div>
                <input className="auth-input" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                <input className="auth-input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="auth-actions">
                  <button className="auth-btn" type="submit">Register</button>
                </div>
              </>
            )}
          </form>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
        <div>
          <div className="sale-banner">Limited Time Offer — 20% OFF for New Signups</div>
          <div className="promo-grid" style={{ marginTop: 8 }}>
            {promos.map((src, i) => (
              <img key={i} className="promo-img" src={`${API_BASE}${src}`} alt={`promo-${i}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
