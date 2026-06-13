'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './dashboard.module.css';

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface Entry {
  id: string;
  user_id: string | null;
  user_name: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  created_at: string;
}

interface DashboardClientProps {
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'Member' | 'Viewer';
    email?: string;
  };
}

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Venue', 'Equipment', 'Misc'];
const INCOME_CATEGORIES = ['Ticket Sales', 'Sponsorship', 'Stalls', 'Misc'];

export default function DashboardClient({ currentUser }: DashboardClientProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters State
  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setModalError('');
    setSuccessMessage('');
  };

  const handleStartEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setAmount(entry.amount.toString());
    setEntryType(entry.type);
    setCategory(entry.category);
    setDescription(entry.description);
    setDate(entry.date);
    setModalOpen(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this transaction?');
    if (!confirmDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from('entries')
        .delete()
        .eq('id', entryId);

      if (deleteError) throw new Error(deleteError.message);

      // Remove from state
      setEntries(entries.filter(e => e.id !== entryId));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const router = useRouter();

  // Load entries and users directly from Supabase via HTTPS
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        // 1. Fetch Users directory from public.users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('name', { ascending: true });

        if (usersError) throw new Error(usersError.message);
        setProfiles(usersData || []);

        // 2. Fetch Entries from entries table
        const { data: entriesData, error: entriesError } = await supabase
          .from('entries')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (entriesError) throw new Error(entriesError.message);

        // Map entries to flatten user_name
        const mapped: Entry[] = (entriesData || []).map((e: any) => ({
          id: e.id,
          user_id: e.user_id,
          user_name: e.user_name || 'Unknown User',
          amount: parseFloat(e.amount),
          type: e.type,
          category: e.category,
          description: e.description || '',
          date: e.date,
          created_at: e.created_at,
        }));

        setEntries(mapped);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(`Failed to connect to Supabase: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle Add/Edit Entry Form
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    setSuccessMessage('');

    if (!amount || parseFloat(amount) <= 0) {
      setModalError('Please enter a valid amount.');
      setSubmitting(false);
      return;
    }

    try {
      if (editingEntry) {
        // Edit Mode: Update existing entry in Supabase
        const { data: updatedData, error: updateError } = await supabase
          .from('entries')
          .update({
            amount: parseFloat(amount),
            type: entryType,
            category,
            description,
            date,
          })
          .eq('id', editingEntry.id)
          .select('*');

        if (updateError) throw new Error(updateError.message);
        if (!updatedData || updatedData.length === 0) throw new Error('Transaction could not be updated.');

        const updatedEntry: Entry = {
          id: updatedData[0].id,
          user_id: updatedData[0].user_id,
          user_name: updatedData[0].user_name || currentUser.name,
          amount: parseFloat(updatedData[0].amount),
          type: updatedData[0].type,
          category: updatedData[0].category,
          description: updatedData[0].description || '',
          date: updatedData[0].date,
          created_at: updatedData[0].created_at,
        };

        // Update UI state
        setEntries(entries.map(item => item.id === editingEntry.id ? updatedEntry : item));
        setSuccessMessage('Transaction updated in Supabase database!');
      } else {
        // Add Mode: Insert new entry in Supabase
        const { data: insertedData, error: insertError } = await supabase
          .from('entries')
          .insert({
            user_id: currentUser.id,
            user_name: currentUser.name,
            amount: parseFloat(amount),
            type: entryType,
            category,
            description,
            date,
          })
          .select('*');

        if (insertError) throw new Error(insertError.message);
        if (!insertedData || insertedData.length === 0) throw new Error('Transaction could not be saved.');

        const mappedNewEntry: Entry = {
          id: insertedData[0].id,
          user_id: insertedData[0].user_id,
          user_name: insertedData[0].user_name || currentUser.name,
          amount: parseFloat(insertedData[0].amount),
          type: insertedData[0].type,
          category: insertedData[0].category,
          description: insertedData[0].description || '',
          date: insertedData[0].date,
          created_at: insertedData[0].created_at,
        };

        // Add to UI state
        setEntries([mappedNewEntry, ...entries]);
        setSuccessMessage('Transaction added to Supabase database!');
      }
      
      // Reset Form
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setEditingEntry(null);
      
      setTimeout(() => {
        setModalOpen(false);
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Change entry type inside modal (resets category dropdown)
  const handleTypeChange = (type: 'income' | 'expense') => {
    setEntryType(type);
    setCategory(type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  // Filter Logic
  const filteredEntries = entries.filter((e) => {
    if (filterUser && e.user_id !== filterUser) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterDateStart && e.date < filterDateStart) return false;
    if (filterDateEnd && e.date > filterDateEnd) return false;
    return true;
  });

  // Calculate Summary Totals
  const totalIncome = filteredEntries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = filteredEntries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className={styles.dashboardWrapper}>
      {/* Header Navigation */}
      <header className="navbar">
        <div className="brand">
          Bridge<span>Kerala</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{currentUser.name}</span>
            <span className={`${styles.userRole} badge ${currentUser.role === 'admin' ? 'badge-expense' : 'badge-income'}`}>
              {currentUser.role}
            </span>
          </div>
          
          {currentUser.role === 'admin' && (
            <button 
              onClick={() => router.push('/admin')} 
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Admin Panel
            </button>
          )}
          
          <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Sign Out">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>

      <main className="container" style={{ paddingBottom: '100px' }}>
        {error && (
          <div className="alert alert-error" style={{ marginTop: '20px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Summary Dashboard cards */}
        <section className={styles.summarySection}>
          <div className={`${styles.summaryCard} ${styles.incomeCard} glass-card`}>
            <h3>Total Revenue</h3>
            <p className={styles.amountText}>{formatCurrency(totalIncome)}</p>
            <div className={styles.cardAccentLine} style={{ backgroundColor: 'var(--color-mint)' }} />
          </div>

          <div className={`${styles.summaryCard} ${styles.expenseCard} glass-card`}>
            <h3>Total Expenses</h3>
            <p className={styles.amountText}>{formatCurrency(totalExpense)}</p>
            <div className={styles.cardAccentLine} style={{ backgroundColor: 'var(--color-coral)' }} />
          </div>

          <div className={`${styles.summaryCard} ${styles.balanceCard} glass-card`}>
            <h3>Net Balance</h3>
            <p className={`${styles.amountText} ${netBalance >= 0 ? styles.positiveBalance : styles.negativeBalance}`}>
              {formatCurrency(netBalance)}
            </p>
            <div className={styles.cardAccentLine} style={{ backgroundColor: netBalance >= 0 ? 'var(--color-mint)' : 'var(--color-coral)' }} />
          </div>
        </section>

        {/* Quick Add Button & Header */}
        <section className={styles.sectionHeader}>
          <h2>Shared Feed</h2>
          {currentUser.role !== 'Viewer' ? (
            <button onClick={() => setModalOpen(true)} className="btn btn-accent" disabled={loading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Entry
            </button>
          ) : (
            <span className="badge badge-income" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
              Viewer Mode (Read-Only)
            </span>
          )}
        </section>

        {/* Filters Panel */}
        <section className={`${styles.filtersCard} glass-card`}>
          <div className={styles.filterTitle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Filter Entries
          </div>
          <div className={styles.filterGrid}>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>User</label>
              <select 
                className="form-control" 
                value={filterUser} 
                onChange={(e) => setFilterUser(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                disabled={loading}
              >
                <option value="">All Users</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Category</label>
              <select 
                className="form-control" 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                disabled={loading}
              >
                <option value="">All Categories</option>
                <optgroup label="Income">
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
                <optgroup label="Expenses">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>From Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>To Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                disabled={loading}
              />
            </div>
          </div>
          
          {(filterUser || filterCategory || filterDateStart || filterDateEnd) && (
            <button 
              onClick={() => {
                setFilterUser('');
                setFilterCategory('');
                setFilterDateStart('');
                setFilterDateEnd('');
              }}
              className={styles.clearFiltersBtn}
            >
              Clear Active Filters
            </button>
          )}
        </section>

        {/* Transactions Feed */}
        <section className={styles.feedSection}>
          {loading ? (
            <div className={styles.emptyFeed}>
              <span className={styles.spinner} style={{ borderTopColor: 'var(--color-ocean-medium)', width: '32px', height: '32px' }}></span>
              <p style={{ marginTop: '12px' }}>Connecting to Supabase Database...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyFeed}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-ocean-light)', marginBottom: '16px' }}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
              <p>No transactions match your search filters.</p>
            </div>
          ) : (
            filteredEntries.map((e) => (
              <div key={e.id} className={`${styles.feedItem} glass-card`}>
                <div className={styles.feedItemLeft}>
                  <div className={`${styles.avatar} ${e.type === 'income' ? styles.avatarIncome : styles.avatarExpense}`}>
                    {getInitials(e.user_name)}
                  </div>
                  <div className={styles.entryDetails}>
                    <div className={styles.entryUserRow}>
                      <span className={styles.entryUser}>{e.user_name}</span>
                      <span className={styles.entryDate}>
                        {new Date(e.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {e.description && <p className={styles.entryDesc}>{e.description}</p>}
                    {e.user_id === currentUser.id && (
                      <div className={styles.entryActions}>
                        <button onClick={() => handleStartEdit(e)} className={styles.actionBtnEdit}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteEntry(e.id)} className={styles.actionBtnDelete}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={styles.feedItemRight}>
                  <div className={`${styles.entryAmount} ${e.type === 'income' ? styles.incomeText : styles.expenseText}`}>
                    {e.type === 'income' ? '+' : '-'} {formatCurrency(e.amount)}
                  </div>
                  <span className={`badge ${e.type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                    {e.category}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Add/Edit Entry Slide-up Modal Drawer */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={`${styles.modalDrawer} glass-card`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingEntry ? 'Edit Entry' : 'Add New Entry'}</h3>
              <button className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {modalError && (
              <div className="alert alert-error">
                {modalError}
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {successMessage}
              </div>
            )}

            {/* Type selector toggle */}
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeBtn} ${entryType === 'expense' ? styles.typeBtnExpenseActive : ''}`}
                onClick={() => handleTypeChange('expense')}
              >
                Expense
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${entryType === 'income' ? styles.typeBtnIncomeActive : ''}`}
                onClick={() => handleTypeChange('income')}
              >
                Revenue/Income
              </button>
            </div>

            <form onSubmit={handleSubmitEntry} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-amount">Amount (INR)</label>
                <input
                  type="number"
                  id="modal-amount"
                  className="form-control"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-category">Category</label>
                <select
                  id="modal-category"
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                >
                  {entryType === 'expense'
                    ? EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    : INCOME_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-date">Date</label>
                <input
                  type="date"
                  id="modal-date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-desc">Description</label>
                <textarea
                  id="modal-desc"
                  className="form-control"
                  placeholder="Provide some details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  disabled={submitting}
                  style={{ resize: 'none' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: '20px' }}
                disabled={submitting}
              >
                {submitting ? <span className={styles.spinner}></span> : editingEntry ? 'Update Entry' : 'Save Entry'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
