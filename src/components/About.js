import React from 'react'
import '../home.css'

export default function About() {
  return (
    <div className="about-page-container">
      <div 
        className="about-background" 
        style={{ backgroundImage: "url('/ownerwithbg.jpeg')" }} 
      />
      
      <div className="about-content-card">
        <div className="about-left-col">
          <h1 className="about-title">
            <span style={{ color: '#e91e63' }}>About</span> <span style={{ color: '#3f51b5' }}>AJ Meat Store</span>
          </h1>
          
          <p className="about-text">
            Welcome to AJ Meat Store, your trusted source for premium quality meat. 
            We take pride in delivering the freshest cuts, ensuring hygiene and taste 
            in every order. Our mission is to bring farm-fresh goodness directly to 
            your doorstep with the highest standards of quality control.
          </p>

          <p className="about-text">
            Founded by our visionary owner, we are dedicated to serving our community with integrity and passion.
          </p>

          <a href="tel:+919004261398" className="phone-button-wrapper">
            <div className="phone-circle">
              <span role="img" aria-label="phone">📞</span>
            </div>
            <span className="phone-label">Call Owner</span>
          </a>
        </div>

        <div className="about-right-col">
          <img src="/ownerwithbg.jpeg" alt="Owner" className="owner-image" />
        </div>
      </div>
    </div>
  )
}
