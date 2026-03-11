import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { API_BASE } from '../api'

export default function PhonePeReturn() {
  const [status, setStatus] = useState('PENDING')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    const params = new URLSearchParams(location.search)
    const orderId = params.get('orderId')
    if (!orderId) {
      setMessage('Missing orderId')
      setLoading(false)
      return
    }
    let cancelled = false
    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/api/phonepe/order/${encodeURIComponent(orderId)}/status`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Status error')
        const s = d.state || (d.data && d.data.state) || 'PENDING'
        setStatus(s)
        if (s === 'COMPLETED') {
          const cr = await fetch(`${API_BASE}/api/cart/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
          const bill = await cr.json()
          if (!cr.ok) throw new Error(bill.error || 'Checkout failed')
          if (!cancelled) navigate('/cart', { state: { bill } })
          return
        }
        if (s === 'FAILED') {
          setMessage('Payment failed')
          setLoading(false)
          return
        }
        setLoading(false)
        setTimeout(poll, 3000)
      } catch (e) {
        setMessage(e.message || 'Error')
        setLoading(false)
      }
    }
    poll()
    return () => { cancelled = true }
  }, [navigate, location.search])
  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h2>Processing PhonePe Payment</h2>
      <div>Status: {status}</div>
      {message && <div style={{ color: '#b00020', marginTop: 8 }}>{message}</div>}
      <div style={{ marginTop: 16 }}>
        <button onClick={()=>navigate('/cart')} className="aj-checkout-btn">Back to Cart</button>
      </div>
    </div>
  )
}
