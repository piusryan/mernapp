import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

const PageLayout = ({ children }) => (
  <motion.div
    initial={{ x: '100%', opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: '-100%', opacity: 0 }}
    transition={{ duration: 0.1, ease: "easeOut" }}
    style={{ width: '100%' }}
  >
    {children}
  </motion.div>
);

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageLayout><Home /></PageLayout>} />
        <Route path="/login" element={<PageLayout><Login /></PageLayout>} />
        <Route path="/items" element={<PageLayout><Items /></PageLayout>} />
        <Route path="/cart" element={<PageLayout><Cart /></PageLayout>} />
        <Route path="/wishlist" element={<PageLayout><Wishlist /></PageLayout>} />
        <Route path="/profile" element={<PageLayout><Profile /></PageLayout>} />
        <Route path="/payment" element={<PageLayout><Payment /></PageLayout>} />
        <Route path="/admin" element={<PageLayout><AdminDashboard /></PageLayout>} />
        <Route path="/track" element={<PageLayout><Track /></PageLayout>} />
      </Routes>
    </AnimatePresence>
  );
}
