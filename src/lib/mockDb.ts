export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Entry {
  id: string;
  user_id: string | null;
  user_name: string; // mapped creator name
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  created_at: string;
}

// In-memory mock database tables
let mockProfiles: Profile[] = [
  {
    id: 'admin-uuid-1111',
    name: 'Bridge Admin',
    email: 'admin@gmail.com',
    role: 'admin',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-uuid-2222',
    name: 'Suresh Kumar',
    email: 'suresh@bridge.kl',
    role: 'user',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-uuid-3333',
    name: 'Anjali Menon',
    email: 'anjali@bridge.kl',
    role: 'user',
    created_at: new Date().toISOString()
  }
];

let mockEntries: Entry[] = [
  {
    id: 'entry-1',
    user_id: 'user-uuid-2222',
    user_name: 'Suresh Kumar',
    amount: 150000.00,
    type: 'income',
    category: 'Sponsorship',
    description: 'Lead Sponsorship from Marari Coconut Resort',
    date: '2026-06-10',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-2',
    user_id: 'user-uuid-3333',
    user_name: 'Anjali Menon',
    amount: 85000.00,
    type: 'income',
    category: 'Ticket Sales',
    description: 'Early-Bird General Admission Phase 1 Sales',
    date: '2026-06-11',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-3',
    user_id: 'admin-uuid-1111',
    user_name: 'Bridge Admin',
    amount: 45000.00,
    type: 'expense',
    category: 'Venue',
    description: 'Beach canopy and stage construction permits',
    date: '2026-06-08',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-4',
    user_id: 'user-uuid-2222',
    user_name: 'Suresh Kumar',
    amount: 62000.00,
    type: 'expense',
    category: 'Equipment',
    description: 'Subwoofer array and outdoor sound system rental',
    date: '2026-06-09',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-5',
    user_id: 'user-uuid-3333',
    user_name: 'Anjali Menon',
    amount: 18000.00,
    type: 'income',
    category: 'Stalls',
    description: 'Food court stall space rental - Kozhikode Halwa Hub',
    date: '2026-06-12',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-6',
    user_id: 'admin-uuid-1111',
    user_name: 'Bridge Admin',
    amount: 12500.00,
    type: 'expense',
    category: 'Food',
    description: 'Catering for organizing team and artists (Traditional Sadhya)',
    date: '2026-06-12',
    created_at: new Date().toISOString()
  },
  {
    id: 'entry-7',
    user_id: 'user-uuid-2222',
    user_name: 'Suresh Kumar',
    amount: 5500.00,
    type: 'expense',
    category: 'Transport',
    description: 'Airport transfers for music guest performers',
    date: '2026-06-11',
    created_at: new Date().toISOString()
  }
];

export const mockDb = {
  // Profiles Management
  getProfiles: (): Profile[] => {
    return [...mockProfiles];
  },
  
  addProfile: (name: string, email: string, role: 'admin' | 'user' = 'user'): Profile => {
    const newProfile: Profile = {
      id: `mock-user-${Math.random().toString(36).substr(2, 9)}`,
      name,
      email,
      role,
      created_at: new Date().toISOString()
    };
    mockProfiles.push(newProfile);
    return newProfile;
  },
  
  deleteProfile: (id: string): boolean => {
    const initialLength = mockProfiles.length;
    mockProfiles = mockProfiles.filter(p => p.id !== id);
    // Also nullify user_id in entries associated with this user
    mockEntries = mockEntries.map(e => e.user_id === id ? { ...e, user_id: null } : e);
    return mockProfiles.length < initialLength;
  },

  // Entries Management
  getEntries: (): Entry[] => {
    // Return sorted by date descending
    return [...mockEntries].sort((a, b) => b.date.localeCompare(a.date));
  },
  
  addEntry: (entry: Omit<Entry, 'id' | 'created_at' | 'user_name'>): Entry => {
    const user = mockProfiles.find(p => p.id === entry.user_id) || { name: 'Unknown User' };
    const newEntry: Entry = {
      ...entry,
      id: `mock-entry-${Math.random().toString(36).substr(2, 9)}`,
      user_name: user.name,
      created_at: new Date().toISOString()
    };
    mockEntries.push(newEntry);
    return newEntry;
  }
};
