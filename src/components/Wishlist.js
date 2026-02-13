import React, { useEffect, useState } from 'react';
import { API_BASE } from '../api';
import '../home.css';

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    fetch(`${API_BASE}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const moveToCart = async (item) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Add to cart
    await fetch(`${API_BASE}/api/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId: item.itemId, quantity: 1 })
    });

    // Remove from wishlist
    const res = await fetch(`${API_BASE}/api/wishlist/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId: item.itemId })
    });
    const d = await res.json();
    setItems(d.items || []);
    alert('Moved to cart!');
  };

  const remove = async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/wishlist/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId: id })
    });
    const d = await res.json();
    setItems(d.items || []);
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h2>My Wishlist</h2>
      {items.length === 0 ? (
        <p>Your wishlist is empty.</p>
      ) : (
        <div className="aj-items-grid">
          {items.map(item => (
            <div key={item.itemId} className="aj-item-card">
              <div className="aj-item-card-img-wrap">
                <img src={`${API_BASE}${item.imagePath}`} alt={item.name} />
              </div>
              <div className="aj-item-body">
                <div className="aj-item-name">{item.name}</div>
                <div style={{ marginTop: '5px' }}>₹{item.price}</div>
                <div className="aj-item-actions">
                  <button className="aj-cta" onClick={() => moveToCart(item)} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>Move to Cart</button>
                  <button className="btn-modern" onClick={() => remove(item.itemId)} style={{ fontSize: '0.8rem' }}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
