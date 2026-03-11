import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function PhonePe() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    ;(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/phonepe/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to start PhonePe')
        const url = d.redirectUrl
        if (!url) throw new Error('Missing redirect URL')
        window.location.href = url
      } catch (e) {
        setError(e.message || 'Error')
        setLoading(false)
      }
    })()
  }, [navigate])
  if (loading) return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h2>Redirecting to PhonePe</h2>
      <p>Please wait...</p>
    </div>
  )
  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h2>PhonePe Payment</h2>
      <p style={{ color: '#b00020' }}>{error}</p>
      <button onClick={()=>navigate('/cart')} className="aj-checkout-btn">Back to Cart</button>
    </div>
  )
}
