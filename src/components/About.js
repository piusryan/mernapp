import React from 'react'
import '../home.css'
import ownerImg from '../owner.jpeg'

export default function About() {
  return (
    <div className="container about-page-container">
      <div className="about-content-wrapper">
        <div className="about-text-section">
          <h1 className="about-title">
            <span className="highlight-pink">About </span>
            <span className="highlight-purple">AJ Meat </span>
            <span className="highlight-pink">Store</span>
          </h1>
          <p className="about-desc">
            Welcome to AJ Meat Store, your trusted source for premium quality meat. We take pride in delivering the freshest cuts, ensuring hygiene and taste in every order. Our mission is to bring farm-fresh goodness directly to your doorstep with the highest standards of quality control.
          </p>
          <p className="about-desc">
            Founded by our visionary owner, we are dedicated to serving our community with integrity and passion.
          </p>
          
          <a href="tel:+919876543210" className="call-owner-card">
             <div className="phone-icon-circle">📞</div>
             <span className="call-text">Call Owner</span>
          </a>
        </div>
        <div className="about-image-section">
           <img src={ownerImg} alt="Owner" className="owner-photo" />
        </div>
      </div>
    </div>
  )
}
