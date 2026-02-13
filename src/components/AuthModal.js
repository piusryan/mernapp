import React, { useEffect, useState } from 'react'
import '../home.css'
import { API_BASE } from '../api'

export default function AuthModal({ onClose }) {
  const [images, setImages] = useState([])

  useEffect(() => {
    fetch(`${API_BASE}/api/items`)
      .then((r) => r.json())
      .then((arr) => setImages(arr.map((it)=>it.imagePath).filter(Boolean).slice(0,4)))
      .catch(() => setImages([]))
  }, [])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="sale-banner">Sign up today — welcome offers unlocked</div>
          <p style={{ marginTop: 8 }}>Create your account to access exclusive discounts and free delivery perks.</p>
          <div className="auth-actions">
            <a className="auth-btn" href="/login">Login</a>
            <a className="auth-btn" href="/login">Create Account</a>
          </div>
        </div>
        <div>
          <div className="promo-grid">
            {images.map((src, i) => (
              <img 
                key={i} 
                className="promo-img" 
                src={`${API_BASE}${src}`} 
                alt={`promo-${i}`} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${API_BASE}/site-assets/plain.jpg`;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
