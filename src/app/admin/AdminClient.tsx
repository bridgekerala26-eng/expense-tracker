'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AdminClientProps {
  currentUserId: string;
  currentUserName: string;
}

export default function AdminClient({
  currentUserId,
  currentUserName,
}: AdminClientProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // CSV Export State
  const [exporting, setExporting] = useState(false);
  
  const router = useRouter();

  // Load user directory directly from Supabase via HTTPS
  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const { data, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('name', { ascending: true });

        if (usersError) throw new Error(usersError.message);

        // Map users to simulate role output based on email
        const mapped: Profile[] = (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.email.toLowerCase() === 'admin@gmail.com' ? 'admin' : 'user'
        }));

        setUsers(mapped);
      } catch (err: any) {
        console.error('Error loading users:', err);
        setError(`Failed to retrieve user directory from Supabase: ${err.message}`);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  }, []);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user.');
      }

      // Add newly created user profile to state
      setUsers([...users, data.user].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccess(`User "${name}" created successfully!`);
      
      // Clear inputs
      setName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUserId) {
      alert('You cannot delete your own admin account!');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete user "${userName}"? This will also remove their associated profile.`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user.');
      }

      // Filter out deleted user
      setUsers(users.filter(u => u.id !== userId));
      setSuccess(`User "${userName}" has been deleted.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Export CSV
  const handleExportCSV = async () => {
    setExporting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/entries');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch entries for export.');
      }

      const entries = data.entries || [];

      if (entries.length === 0) {
        throw new Error('No entries found to export.');
      }

      // Generate CSV Headers
      const headers = ['Transaction ID', 'Date', 'Type', 'Category', 'Creator/User', 'Amount (INR)', 'Description'];
      
      // Generate CSV Rows
      const csvRows = [
        headers.join(','), 
        ...entries.map((e: any) => {
          return [
            JSON.stringify(e.id),
            JSON.stringify(e.date),
            JSON.stringify(e.type),
            JSON.stringify(e.category),
            JSON.stringify(e.user_name),
            e.amount,
            JSON.stringify(e.description || '')
          ].join(',');
        })
      ];

      const csvContent = csvRows.join('\n');
      
      // Trigger Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bridge_kerala_entries_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('CSV exported successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.adminWrapper}>
      {/* Navbar */}
      <header className="navbar">
        <div className="brand" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          Bridge<span>Kerala</span> <span className={styles.brandPanel}>Admin</span>
        </div>
        <div className={styles.headerRight}>
          <button onClick={() => router.push('/')} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="container" style={{ paddingBottom: '60px' }}>
        <div className={styles.adminTitleRow}>
          <h2>Admin Control Panel</h2>
        </div>

        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>{success}</span>
          </div>
        )}

        {/* User Registration Form */}
        <section className={`${styles.adminCard} glass-card`}>
          <h3>Create New User Account</h3>
          <p className={styles.cardSubtitle}>Register a user to let them add transactions and view the feed. Note: user administration requires database connection.</p>
          
          <form onSubmit={handleCreateUser} className={styles.form}>
            <div className={styles.formGrid}>
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label" htmlFor="user-name">Full Name</label>
                <input
                  type="text"
                  id="user-name"
                  className="form-control"
                  placeholder="e.g. Ramesh Nair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label" htmlFor="user-email">Email Address</label>
                <input
                  type="email"
                  id="user-email"
                  className="form-control"
                  placeholder="e.g. ramesh@bridge.kl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label" htmlFor="user-pass">Password</label>
                <input
                  type="password"
                  id="user-pass"
                  className="form-control"
                  placeholder="e.g. securepass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-accent"
              style={{ marginTop: '20px', alignSelf: 'flex-start' }}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Register User'}
            </button>
          </form>
        </section>

        {/* CSV Export Card */}
        <section className={`${styles.adminCard} glass-card`}>
          <h3>Data Operations</h3>
          <p className={styles.cardSubtitle}>Download the entire shared feed history as a CSV file.</p>
          
          <button 
            onClick={handleExportCSV} 
            className="btn btn-primary"
            style={{ marginTop: '10px' }}
            disabled={exporting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {exporting ? 'Exporting...' : 'Export All Entries to CSV'}
          </button>
        </section>

        {/* User Directory List */}
        <section className={`${styles.adminCard} glass-card`}>
          <h3>Active Users Directory ({users.length})</h3>
          <p className={styles.cardSubtitle} style={{ marginBottom: '20px' }}>Active users permitted to write transactions. Delete profiles if needed.</p>

          <div className={styles.userList}>
            {loadingUsers ? (
              <p className={styles.noUsers}>Loading user directory from Supabase...</p>
            ) : users.length === 0 ? (
              <p className={styles.noUsers}>No registered users in the database.</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className={styles.userRow}>
                  <div className={styles.userInfoCol}>
                    <div className={styles.userNameRow}>
                      <span className={styles.userNameText}>{u.name}</span>
                      <span className={`badge ${u.role === 'admin' ? 'badge-expense' : 'badge-income'}`} style={{ fontSize: '0.65rem' }}>
                        {u.role}
                      </span>
                    </div>
                    <span className={styles.userEmailText}>{u.email}</span>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    className="btn btn-danger"
                    style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                    disabled={u.id === currentUserId} 
                    title={u.id === currentUserId ? 'You cannot delete yourself' : 'Delete user'}
                  >
                    Delete User
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
