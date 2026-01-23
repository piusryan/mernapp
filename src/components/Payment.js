import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';

// Make sure to add REACT_APP_STRIPE_KEY to your .env file
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_KEY || 'pk_test_placeholder'); 

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/cart',
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/cart/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout failed');
        
        // Navigate back to cart with bill data
        navigate('/cart', { state: { bill: data } });
      } catch (err) {
        setMessage('Payment successful but order creation failed: ' + err.message);
        setIsLoading(false);
      }
    } else {
        setMessage('Unexpected state');
        setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      <button disabled={isLoading || !stripe || !elements} id="submit" className="btn-modern" style={{ marginTop: 20, width: '100%', background: '#0a7' }}>
        <span id="button-text">
          {isLoading ? "Processing..." : "Pay Now"}
        </span>
      </button>
      {message && <div id="payment-message" style={{ color: 'red', marginTop: 10 }}>{message}</div>}
    </form>
  );
}

export default function Payment() {
  const [clientSecret, setClientSecret] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    fetch(`${API_BASE}/api/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
            alert(data.error);
            navigate('/cart');
        } else {
            setClientSecret(data.clientSecret);
        }
      })
      .catch((err) => {
        console.error("Payment init error:", err);
        alert(`Failed to initialize payment: ${err.message}. Checking API: ${API_BASE}`);
        navigate('/cart');
      });
  }, [navigate]);

  const appearance = {
    theme: 'stripe',
  };
  const options = {
    clientSecret,
    appearance,
  };

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 30 }}>Complete Payment</h2>
      {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      )}
    </div>
  );
}
