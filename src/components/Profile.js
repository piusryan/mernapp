import React, { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import '../home.css';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Fetch User
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (data && !data.error) {
        setUser(data);
        setEmail(data.email || '');
      }
    });

    // Fetch Orders
    fetch(`${API_BASE}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) {
        setOrders(data);
      }
    });
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          email,
          password: password || undefined, // Only send if changed
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Profile updated successfully');
        setPassword(''); // Clear password field
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  if (!user) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h2>My Profile</h2>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button 
          className={activeTab === 'orders' ? 'auth-tab active' : 'auth-tab'} 
          onClick={() => setActiveTab('orders')}
        >
          My Orders
        </button>
        <button 
          className={activeTab === 'profile' ? 'auth-tab active' : 'auth-tab'} 
          onClick={() => setActiveTab('profile')}
        >
          Edit Profile
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="item-card" style={{ padding: '20px' }}>
          <h3>Order History</h3>
          {orders.length === 0 ? (
            <p>No orders found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {orders.map(order => (
                <div key={order._id} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>{order.trackingNumber || order._id}</span>
                    <span>₹{order.totalAmount}</span>
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9em' }}>
                    {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                  </div>
                  <div style={{ margin: '5px 0' }}>
                    <span className="status-badge">{order.status}</span>
                  </div>
                  <div style={{ fontSize: '0.9em' }}>
                    {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="item-card" style={{ padding: '20px' }}>
          <h3>Edit Details</h3>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {message && <p style={{ color: 'green' }}>{message}</p>}
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
              <input type="text" value={user.username} disabled className="search-input" style={{ backgroundColor: '#f0f0f0', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="search-input" 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>New Password (leave blank to keep current)</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="search-input" 
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="search-btn" style={{ marginTop: '10px' }}>Save Changes</button>
          </form>
        </div>
      )}
    </div>
  );
}
