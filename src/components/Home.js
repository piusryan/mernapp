import React, { useEffect, useRef, useState } from 'react'
import '../home.css'
import AuthModal from './AuthModal'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function Home() {
  const [slides, setSlides] = useState([])
  const [picks, setPicks] = useState([])
  const [qty, setQty] = useState({})
  const [aiPhraseIndex, setAiPhraseIndex] = useState(0)
  const scroller = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const load = async () => {
      try {
        let arr = []
        if (token) {
          const res = await fetch(`${API_BASE}/api/recommendations`, { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) arr = await res.json()
        }
        if (!arr.length) {
          const r = await fetch(`${API_BASE}/api/items`)
          arr = await r.json()
        }
        setPicks(arr.slice(0, 8))
        const imgRes = await fetch(`${API_BASE}/api/offerimages`)
        if (imgRes.ok) {
          const pics = await imgRes.json()
          if (pics && pics.length) {
            setSlides(pics.slice(0, 12))
          } else {
            const imgs = arr.map((it) => it.imagePath).filter(Boolean)
            setSlides(imgs.slice(0, 12))
          }
        } else {
          const imgs = arr.map((it) => it.imagePath).filter(Boolean)
          setSlides(imgs.slice(0, 12))
        }
      } catch {
        setPicks([]); setSlides([])
      }
    }
    load()
  }, [])

  useEffect(() => {
    const phrases = ['weekday curries', 'BBQ nights', 'protein meal prep', 'Sunday biryani']
    if (!phrases.length) return
    const id = setInterval(() => {
      setAiPhraseIndex((i) => (i + 1) % phrases.length)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  async function addPick(itemId) {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    const q = Math.max(1, Number(qty[itemId] || 1))
    const res = await fetch(`${API_BASE}/api/cart/add`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, quantity: q })
    })
    if (res.ok) navigate('/cart')
  }

  const heroSlides = slides.slice(0, 3)

  return (
    <div className="container aj-hero-container">
      <div className="aj-hero-shell">
        <div className="aj-hero-bg-orb aj-hero-orb-1" />
        <div className="aj-hero-bg-orb aj-hero-orb-2" />
        <div className="aj-hero-bg-orb aj-hero-orb-3" />
        <div className="aj-hero-grid">
          <div className="aj-hero-left">
            <div className="aj-hero-pill-row">
              <span className="aj-hero-pill">New</span>
            </div>
            <h1 className="aj-hero-title">
              AJ
              <span className="aj-hero-title-highlight"> Meat Store</span>
            </h1>
            <p className="aj-hero-subtitle">
              Fresh Chicken Breast, Mutton Curry Cut, Prawns and Chicken Lollipop, cleaned,
              trimmed and packed cold-chain so every curry, fry and grill starts with butcher-grade meat.
            </p>
            <div className="aj-hero-cta-row">
              <button className="aj-hero-cta-primary" onClick={() => navigate('/items')}>
                Start Order
              </button>
              <button className="aj-hero-cta-ghost" onClick={() => {
                const el = scroller.current
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}>
                View Flavours
              </button>
            </div>
            <div className="aj-hero-ai">
              <div className="aj-hero-ai-label">Smart butcher</div>
              <div className="aj-hero-ai-text">
                Our master butchers handpick perfect cuts for your
                <span className="aj-hero-ai-chip">
                  {['weekday curries', 'BBQ nights', 'protein meal prep', 'Sunday biryani'][aiPhraseIndex]}
                </span>
              </div>
            </div>
            <ul className="aj-hero-flavour-list">
              {(picks.length ? picks.slice(0, 6) : [
                { _id: 'demo-1', name: 'Fresh Chicken Breast' },
                { _id: 'demo-2', name: 'Mutton Curry Cut' },
                { _id: 'demo-3', name: 'Prawns (Cleaned & Deveined)' },
                { _id: 'demo-4', name: 'Chicken Lollipop' },
                { _id: 'demo-5', name: 'Boneless Chicken Cubes' },
                { _id: 'demo-6', name: 'Fish Fillet' }
              ]).map((it) => (
                <li key={it._id}>{it.name}</li>
              ))}
            </ul>
          </div>
          <div className="aj-hero-right">
            <div className="aj-hero-scene">
              <div className="aj-hero-glass-ring" />
              <div className="aj-hero-drip" />
              <div className="aj-hero-floating-card">
                <div className="aj-hero-floating-glow" />
                {heroSlides.length ? (
                  heroSlides.map((src, i) => (
                    <div key={i} className={`aj-hero-chip aj-hero-chip-${i + 1}`}>
                      <img src={`${API_BASE}${src}`} alt={`hero-${i}`} />
                    </div>
                  ))
                ) : (
                  <div className="aj-hero-placeholder">Your hero treats appear here</div>
                )}
                <button className="aj-hero-floating-cta" onClick={() => navigate('/items')}>
                  Order online
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="top-picks">
        <h3>Top Picks For You</h3>
        <div className="top-list" ref={scroller}>
          {picks.map((it) => (
            <div key={it._id} className="item-card top-card">
              {it.imagePath && (
                <img src={`${API_BASE}${it.imagePath}`} alt={it.name} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
              )}
              <div className="content">
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ marginTop: 4 }}>
                  <span className="price-old">₹{it.price + 20}</span>
                  <span>₹{it.price}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                </div>
                <div className="actions" style={{ justifyContent: 'space-between' }}>
                  <div className="mini-qty">
                    <button onClick={() => setQty((p)=>({ ...p, [it._id]: Math.max(1, (p[it._id]||1)-1) }))}>−</button>
                    <input value={qty[it._id] ?? 1} readOnly />
                    <button onClick={() => setQty((p)=>({ ...p, [it._id]: (p[it._id]||1)+1 }))}>+</button>
                  </div>
                  <button className="aj-cta" onClick={() => addPick(it._id)}>Add</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!localStorage.getItem('token') && <AuthModal onClose={()=>{}} />}
    </div>
  )
}
