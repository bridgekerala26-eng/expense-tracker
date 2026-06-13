'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Check session status on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        // If already authenticated, redirect to dashboard
        if (data.authenticated) {
          router.push('/');
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    }
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      // Login successful, store session in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user-session', JSON.stringify({
          name: data.user.name,
          email: data.user.email,
          role: data.user.role
        }));
      }

      // Login successful, redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={`${styles.loginCard} glass-card`}>
        <div className={styles.header}>
          <div className={styles.logo}>
            Bridge<span>Kerala</span>
          </div>
          <p className={styles.subtitle}>Expense & Revenue Tracker</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="form-control"
              placeholder="e.g. user@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-accent btn-block"
            style={{ marginTop: '30px' }}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner}></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>


      </div>
    </div>
  );
}
