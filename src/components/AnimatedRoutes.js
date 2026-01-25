import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Login from './Login';
import Items from './Items';
import Cart from './Cart';
import Payment from './Payment';
import Home from './Home';
import AdminDashboard from './AdminDashboard';
import Track from './Track';
import Wishlist from './Wishlist';
import Profile from './Profile';
import '../home.css';

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-slide-container">
      <div className="chicken-pusher">🐔</div>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/items" element={<Items />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/track" element={<Track />} />
      </Routes>
    </div>
  );
}
