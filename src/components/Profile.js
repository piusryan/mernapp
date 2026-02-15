import React, { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import '../home.css';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  if (!user) return <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>Loading...</div>;

  const hasLocation = user && user.location && (user.location.lat != null || user.location.lon != null);
  const locationEnabled = Boolean(user.cookiesAccepted) || hasLocation;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">My Profile</h2>
        <p className="profile-subtitle">Manage your account and view orders</p>
        <div className="profile-location-indicator">
          <span className={`profile-location-dot ${locationEnabled ? 'on' : 'off'}`} />
          <span className="profile-location-text">
            {locationEnabled ? 'Location sharing enabled for delivery and live tracking' : 'Location not enabled yet. Please allow location when prompted.'}
          </span>
        </div>
        <button type="button" className="profile-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
      
      <div className="profile-tabs">
        <button 
          className={`profile-tab ${activeTab === 'orders' ? 'active' : ''}`} 
          onClick={() => setActiveTab('orders')}
        >
          My Orders
        </button>
        <button 
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`} 
          onClick={() => setActiveTab('profile')}
        >
          Edit Profile
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'orders' && (
          <div className="animate-fade-in">
            {orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No orders found.</p>
              </div>
            ) : (
              <div className="order-list">
                {orders.map(order => (
                  <div key={order._id} className="order-card">
                    <div className="order-header">
                      <span className="order-id">#{order.trackingNumber || order._id.slice(-8).toUpperCase()}</span>
                      <span className="order-date">
                        {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="order-body">
                      <div className="order-items">
                        {order.items.map((i, idx) => (
                          <div key={idx}>
                            {i.name} <span style={{opacity: 0.6}}>x{i.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{textAlign: 'right'}}>
                         <div className="order-price">₹{order.totalAmount}</div>
                         <div style={{marginTop: '4px'}}>
                           <span className={`order-status status-${order.status?.toLowerCase() || 'pending'}`}>
                             {order.status}
                           </span>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-form-container animate-fade-in">
            {error && <div style={{ color: '#721c24', background: '#f8d7da', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
            {message && <div style={{ color: '#155724', background: '#d4edda', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>{message}</div>}
            
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  value={user.username} 
                  disabled 
                  className="form-input" 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="form-input" 
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="form-input" 
                  placeholder="Leave blank to keep current"
                />
              </div>
              
              <button type="submit" className="save-btn">Save Changes</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
