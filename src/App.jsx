import React, { useState } from 'react';
import {
  Users, LayoutDashboard, Target, Building2, UserCircle,
  Calendar, ChevronRight, LogOut, Bell, User,
  PanelLeft, Search, Moon, BarChart3, RefreshCw,
  TrendingUp, Phone, ArrowRight, Activity,
  Upload, Plus, Filter, MoreHorizontal, Copy, Grid, List, ChevronDown, Check, ChevronLeft, X, FileText, Download, Building, MapPin,
  MessageSquare, Eye, EyeOff, PlayCircle, Clock, Mail, Edit3, UserX, Key, Trash2
} from 'lucide-react';
import './index.css';



function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [workspace, setWorkspace] = useState(() => JSON.parse(localStorage.getItem('workspace')));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'Dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalMode, setUserModalMode] = useState('add');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [opportunitiesViewMode, setOpportunitiesViewMode] = useState('list');
  const [accountsViewMode, setAccountsViewMode] = useState('list');
  const [selectedLead, setSelectedLead] = useState(null);
  const [persistedLeadId, setPersistedLeadId] = useState(() => localStorage.getItem('selectedLeadId'));
  const [importType, setImportType] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activityList, setActivityList] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [returnTab, setReturnTab] = useState(() => localStorage.getItem('returnTab') || 'Dashboard');
  const [loading, setLoading] = useState(true);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const handleLogin = (data) => {
    setUser(data.user);
    setToken(data.token);
    setWorkspace(data.workspace);
    try {
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      localStorage.setItem('workspace', JSON.stringify(data.workspace));
    } catch (e) {
      console.error('Failed to save auth details to localStorage:', e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setWorkspace(null);
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('workspace');
      localStorage.removeItem('activeTab');
      localStorage.removeItem('selectedLeadId');
      localStorage.removeItem('returnTab');
    } catch (e) {
      console.error('Failed to remove auth details from localStorage:', e);
    }
  };

  // ─── Granular Refresh Functions ─────────────────────────────────────
  // Instead of refetching ALL data for every tiny mutation,
  // we provide targeted refresh functions per resource.

  const refreshLeads = async () => {
    try {
      const res = await fetch('/api/leads', { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLeads(data);
        // Sync selectedLead if currently viewing one
        const currentLeadId = selectedLead?._id || persistedLeadId;
        if (currentLeadId) {
          const updated = data.find(l => l._id === currentLeadId);
          if (updated) setSelectedLead(updated);
        }
      }
    } catch (e) {
      console.error('Error refreshing leads:', e);
    }
  };

  const refreshStats = async () => {
    try {
      const res = await fetch('/api/stats', { headers: authHeaders });
      const data = await res.json();
      setDashboardStats(data);
    } catch (e) {
      console.error('Error refreshing stats:', e);
    }
  };

  const refreshActivity = async () => {
    try {
      const res = await fetch('/api/activity', { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) setActivityList(data);
    } catch (e) {
      console.error('Error refreshing activity:', e);
    }
  };

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) setUsersList(data);
    } catch (e) {
      console.error('Error refreshing users:', e);
    }
  };

  // Full fetch — only used on initial load and background polling
  const fetchData = async () => {
    try {
      const [leadsRes, usersRes, activityRes, statsRes] = await Promise.all([
        fetch('/api/leads', { headers: authHeaders }),
        fetch('/api/users', { headers: authHeaders }),
        fetch('/api/activity', { headers: authHeaders }),
        fetch('/api/stats', { headers: authHeaders })
      ]);

      // If the backend isn't ready yet (503) signal the caller to retry
      if (!leadsRes.ok && leadsRes.status === 503) {
        throw Object.assign(new Error('backend_starting'), { retryable: true });
      }

      const [leadsData, usersData, activityData, statsData] = await Promise.all([
        leadsRes.json(), usersRes.json(), activityRes.json(), statsRes.json()
      ]);

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setUsersList(Array.isArray(usersData) ? usersData : []);
      setActivityList(Array.isArray(activityData) ? activityData : []);
      setDashboardStats(statsData);

      // Sync selectedLead if currently viewing one
      const currentLeadId = selectedLead?._id || persistedLeadId;
      if (currentLeadId) {
        const updatedLead = (Array.isArray(leadsData) ? leadsData : []).find(l => l._id === currentLeadId);
        if (updatedLead) setSelectedLead(updatedLead);
      }

      setLoading(false);
      return true; // success
    } catch (e) {
      if (e.retryable) return false; // signal retry needed
      console.error('Error fetching data:', e);
      setLoading(false);
      return true; // non-retryable error, stop retrying
    }
  };

  // ─── Optimistic State Helpers ───────────────────────────────────────
  // Update a single lead in the leads array (used after PATCH/POST)
  const upsertLeadInState = (updatedLead) => {
    if (!updatedLead?._id) return;
    setLeads(prev => {
      const exists = prev.some(l => l._id === updatedLead._id);
      if (exists) return prev.map(l => l._id === updatedLead._id ? updatedLead : l);
      return [updatedLead, ...prev]; // new lead goes to top
    });
    // Also sync selectedLead if it's the one being viewed
    if (selectedLead?._id === updatedLead._id) {
      setSelectedLead(updatedLead);
    }
  };

  const removeLeadFromState = (leadId) => {
    setLeads(prev => prev.filter(l => l._id !== leadId));
    if (selectedLead?._id === leadId) setSelectedLead(null);
  };

  const upsertUserInState = (updatedUser) => {
    if (!updatedUser?._id) return;
    setUsersList(prev => {
      const exists = prev.some(u => u._id === updatedUser._id);
      if (exists) return prev.map(u => u._id === updatedUser._id ? updatedUser : u);
      return [...prev, updatedUser];
    });
  };

  const removeUserFromState = (userId) => {
    setUsersList(prev => prev.filter(u => u._id !== userId));
  };

  const removeActivityFromState = (activityId) => {
    setActivityList(prev => prev.filter(a => a._id !== activityId));
  };

  // ─── Initial Load & Background Sync ─────────────────────────────────
  React.useEffect(() => {
    if (!token) return;

    // Retry on startup race condition (backend slow to boot)
    let cancelled = false;
    const loadWithRetry = async () => {
      const MAX_RETRIES = 8;
      const RETRY_DELAY_MS = 2000;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (cancelled) return;
        const done = await fetchData();
        if (done) break;
        // Backend not ready yet — wait before next attempt
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    };

    loadWithRetry();
    // Background sync every 60s — keeps data fresh between user actions
    const interval = setInterval(fetchData, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  React.useEffect(() => {
    try {
      localStorage.setItem('activeTab', activeTab);
    } catch (e) {
      console.error('Failed to save activeTab to localStorage:', e);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (loading) return; // Do not overwrite or delete persisted values while initial load is in progress!
    if (selectedLead) {
      try {
        localStorage.setItem('selectedLeadId', selectedLead._id);
      } catch (e) {
        console.error('Failed to save selectedLeadId to localStorage:', e);
      }
      setPersistedLeadId(selectedLead._id);
    } else {
      try {
        localStorage.removeItem('selectedLeadId');
      } catch (e) {
        console.error('Failed to remove selectedLeadId from localStorage:', e);
      }
      setPersistedLeadId(null);
    }
  }, [selectedLead, loading]);

  React.useEffect(() => {
    try {
      localStorage.setItem('returnTab', returnTab);
    } catch (e) {
      console.error('Failed to save returnTab to localStorage:', e);
    }
  }, [returnTab]);

  const handleLeadAction = async (action, data) => {
    // Placeholder for global actions like refresh after edit/add
    await fetchData();
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchPopup(true);
      }
      if (e.key === 'Escape') {
        setShowSearchPopup(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Optimistic User Handlers ───────────────────────────────────────
  const handleDeactivateUser = async (targetUser) => {
    const newStatus = targetUser.status === 'inactive' ? 'active' : 'inactive';
    // Optimistic: update state immediately
    upsertUserInState({ ...targetUser, status: newStatus });
    try {
      const res = await fetch(`/api/users/${targetUser._id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        upsertUserInState(updated);
      } else {
        // Revert on failure
        upsertUserInState(targetUser);
      }
    } catch (e) {
      console.error(e);
      upsertUserInState(targetUser); // revert
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Are you sure you want to delete ${targetUser.name}?`)) return;
    // Optimistic: remove from state immediately
    removeUserFromState(targetUser._id);
    try {
      const res = await fetch(`/api/users/${targetUser._id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
        upsertUserInState(targetUser); // revert
      }
    } catch (e) {
      console.error(e);
      upsertUserInState(targetUser); // revert
    }
  };

  // ─── Optimistic Activity Handlers ───────────────────────────────────
  const handleMarkAllRead = async () => {
    // Optimistic: mark all as read in state immediately
    setActivityList(prev => prev.map(a => ({ ...a, isRead: true })));
    try {
      await fetch('/api/activity/mark-all-read', {
        method: 'POST',
        headers: authHeaders
      });
    } catch (e) {
      console.error(e);
      refreshActivity(); // revert by re-fetching
    }
  };

  const handleDeleteActivity = async (id) => {
    // Optimistic: remove from state immediately
    removeActivityFromState(id);
    try {
      const res = await fetch(`/api/activity/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (!res.ok) refreshActivity(); // revert
    } catch (e) {
      console.error(e);
      refreshActivity(); // revert
    }
  };

  if (!token) {
    return authMode === 'login'
      ? <LoginPage onLogin={handleLogin} onSwitchToSignup={() => setAuthMode('signup')} />
      : <SignupPage onSignup={handleLogin} onSwitchToLogin={() => setAuthMode('login')} />;
  }

  return (
    <div className={`app-container ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-box">{workspace?.name || 'CRM'}</div>
        </div>

        <div className="sidebar-scrollable">
          <div className="nav-section-label">Navigation</div>
          <nav className="nav-menu">
            <div
              className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('Dashboard')}
            >
              <div className="nav-item-icon"><LayoutDashboard size={18} /></div>
              <span>Dashboard</span>
              {activeTab === 'Dashboard' && <ChevronRight size={14} className="nav-item-arrow" />}
            </div>
            <div
              className={`nav-item ${activeTab === 'Opportunities' ? 'active' : ''}`}
              onClick={() => setActiveTab('Opportunities')}
            >
              <div className="nav-item-icon"><Target size={18} /></div>
              <span>Opportunities</span>
              {activeTab === 'Opportunities' && <ChevronRight size={14} className="nav-item-arrow" />}
            </div>
            <div
              className={`nav-item ${activeTab === 'Accounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('Accounts')}
            >
              <div className="nav-item-icon"><Building2 size={18} /></div>
              <span>Accounts</span>
              {activeTab === 'Accounts' && <ChevronRight size={14} className="nav-item-arrow" />}
            </div>
            <div
              className={`nav-item ${activeTab === 'Contact' ? 'active' : ''}`}
              onClick={() => setActiveTab('Contact')}
            >
              <div className="nav-item-icon"><UserCircle size={18} /></div>
              <span>Contact</span>
              {activeTab === 'Contact' && <ChevronRight size={14} className="nav-item-arrow" />}
            </div>
            <div
              className={`nav-item ${activeTab === 'Calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('Calendar')}
            >
              <div className="nav-item-icon"><Calendar size={18} /></div>
              <span>Calendar</span>
              {activeTab === 'Calendar' && <ChevronRight size={14} className="nav-item-arrow" />}
            </div>
          </nav>

          {(user?.role === 'BDM' || user?.role === 'Admin' || user?.isOwner) && (
            <>
              <div className="nav-section-label">Management</div>
              <nav className="nav-menu">
                <div
                  className={`nav-item ${activeTab === 'Users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('Users')}
                >
                  <div className="nav-item-icon"><Users size={18} /></div>
                  <span>Users</span>
                  {activeTab === 'Users' && <ChevronRight size={14} className="nav-item-arrow" />}
                </div>
              </nav>
            </>
          )}

          <div className="nav-section-label">Team</div>
          <div className="team-subtitle">OWNER</div>
          <div className="team-list">
            {usersList.filter(u => u.isOwner).map(u => (
              <TeamMember key={u._id} name={u.name} />
            ))}
          </div>

          <div className="team-subtitle" style={{ marginTop: '1.5rem' }}>MANAGER</div>
          <div className="team-list">
            {usersList.filter(u => !u.isOwner && (u.role === 'BDM' || u.role === 'Admin')).map(u => (
              <TeamMember key={u._id} name={u.name} />
            ))}
          </div>

          <div className="team-subtitle" style={{ marginTop: '1.5rem' }}>AGENTS</div>
          <div className="team-list">
            {usersList.filter(u => !u.isOwner && u.role === 'BDA').map(u => (
              <TeamMember key={u._id} name={u.name} />
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>

          <div className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log out</span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <main className="main-wrapper">
        <header className="top-nav">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft size={18} />
          </button>
          <div className="search-bar-trigger" onClick={() => setShowSearchPopup(true)}>
            <Search size={16} color="#9ca3af" />
            <span>Search everything...</span>
            <div className="kb-hint">⌘ K</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
            <button
              className={`nav-action-btn ${showNotifications ? 'active' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={18} />
              {activityList.some(a => !a.isRead) && <div className="notification-dot"></div>}
            </button>
            {showNotifications && (
              <>
                <div className="popup-overlay-transparent" onClick={() => setShowNotifications(false)}></div>
                <NotificationsPopup
                  onClose={() => setShowNotifications(false)}
                  onNavigate={() => setActiveTab('Notifications')}
                  activity={activityList}
                  onMarkAllRead={handleMarkAllRead}
                />
              </>
            )}
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <RefreshCw size={32} className="animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'Dashboard' && (
              <DashboardView
                stats={dashboardStats}
                leads={leads}
                activityList={activityList}
                onNavigate={setActiveTab}
                onLeadClick={(lead) => {
                  setReturnTab('Dashboard');
                  setSelectedLead(lead);
                  setActiveTab('LeadDetails');
                }}
              />
            )}
            {activeTab === 'LeadDetails' && (
              <LeadDetailsView
                key={selectedLead?._id}
                lead={selectedLead}
                onBack={() => setActiveTab(returnTab)}
                onSuccess={async (updatedLeadFromApi) => {
                  // If the PATCH/POST already returned the updated lead, use it directly
                  if (updatedLeadFromApi?._id) {
                    upsertLeadInState(updatedLeadFromApi);
                    refreshStats(); // background stats refresh
                    refreshActivity(); // background activity refresh
                    return;
                  }
                  // If explicitly null (e.g. from note add), just refresh activity
                  if (updatedLeadFromApi === null) {
                    refreshActivity();
                    return;
                  }
                  // Fallback: fetch single lead + stats
                  try {
                    const [leadRes, statsRes] = await Promise.all([
                      fetch(`/api/leads/${selectedLead._id}`, { headers: authHeaders }),
                      fetch('/api/stats', { headers: authHeaders })
                    ]);
                    if (leadRes.ok && statsRes.ok) {
                      const updatedLead = await leadRes.json();
                      const updatedStats = await statsRes.json();
                      upsertLeadInState(updatedLead);
                      setDashboardStats(updatedStats);
                    } else {
                      refreshLeads();
                      refreshStats();
                    }
                    refreshActivity();
                  } catch (e) {
                    refreshLeads();
                    refreshStats();
                    refreshActivity();
                  }
                }}
                onDelete={() => {
                  removeLeadFromState(selectedLead._id);
                  refreshStats();
                  refreshActivity();
                }}
                onNavigateToOpportunities={() => setActiveTab('Opportunities')}
                authHeaders={authHeaders}
                users={usersList}
                activityList={activityList}
              />
            )}
            {activeTab === 'Opportunities' && (
              <OpportunitiesView
                leads={leads}
                onAdd={() => setShowAddModal(true)}
                onImport={() => { setImportType('leads'); setShowImportModal(true); }}
                viewMode={opportunitiesViewMode}
                setViewMode={setOpportunitiesViewMode}
                users={usersList}
                currentUser={user}
                onLeadClick={(lead) => {
                  setReturnTab('Opportunities');
                  setSelectedLead(lead);
                  setActiveTab('LeadDetails');
                }}
              />
            )}
            {activeTab === 'Accounts' && (
              <AccountsView
                leads={leads.filter(l => ['Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending', 'Payment Received', 'Active Customer / Repeat Order'].includes(l.status))}
                onImport={() => { setImportType('accounts'); setShowImportModal(true); }}
                viewMode={accountsViewMode}
                setViewMode={setAccountsViewMode}
                onLeadClick={(lead) => {
                  setReturnTab('Accounts');
                  setSelectedLead(lead);
                  setActiveTab('LeadDetails');
                }}
              />
            )}
            {activeTab === 'Contact' && (
              <ContactView
                leads={leads}
                onLeadClick={(lead) => {
                  setReturnTab('Contact');
                  setSelectedLead(lead);
                  setActiveTab('LeadDetails');
                }}
              />
            )}
            {activeTab === 'Calendar' && <CalendarView leads={leads.filter(l => l.status !== 'Lost Lead')} />}
            {activeTab === 'Users' && (user?.role === 'BDM' || user?.role === 'Admin' || user?.isOwner) && (
              <UsersView
                users={usersList}
                onImport={() => { setImportType('users'); setShowImportModal(true); }}
                onAdd={() => {
                  setUserModalMode('add');
                  setSelectedUser(null);
                  setShowUserModal(true);
                }}
                onEdit={(user) => {
                  setUserModalMode('edit');
                  setSelectedUser(user);
                  setShowUserModal(true);
                }}
                onResetPassword={(targetUser) => {
                  setResetTargetUser(targetUser);
                  setShowResetPasswordModal(true);
                }}
                onDeactivate={handleDeactivateUser}
                onDelete={handleDeleteUser}
                currentUser={user}
              />
            )}
            {activeTab === 'Notifications' && (
              <NotificationsView
                activity={activityList}
                onMarkAllRead={handleMarkAllRead}
                onDelete={handleDeleteActivity}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAddModal && <AddOpportunityModal onClose={() => setShowAddModal(false)} onSuccess={(newLead) => { if (newLead?._id) upsertLeadInState(newLead); refreshLeads(); refreshStats(); refreshActivity(); }} authHeaders={authHeaders} users={usersList} />}
      {showImportModal && <ImportLeadsModal onClose={() => setShowImportModal(false)} type={importType} onSuccess={() => { refreshLeads(); refreshStats(); refreshActivity(); if (importType === 'users') refreshUsers(); }} authHeaders={authHeaders} />}
      {showUserModal && <UserModal mode={userModalMode} user={selectedUser} onClose={() => setShowUserModal(false)} onSuccess={(savedUser) => { if (savedUser?._id) upsertUserInState(savedUser); else refreshUsers(); }} authHeaders={authHeaders} currentUser={user} />}
      {showResetPasswordModal && <ResetPasswordModal user={resetTargetUser} onClose={() => setShowResetPasswordModal(false)} authHeaders={authHeaders} />}

      {/* Search Popup */}
      {showSearchPopup && <SearchPopup onClose={() => setShowSearchPopup(false)} leads={leads} users={usersList} onLeadClick={(lead) => {
        setSelectedLead(lead);
        setActiveTab('LeadDetails');
        setShowSearchPopup(false);
      }} />}
    </div>
  );
}

const DashboardView = ({ stats, leads, activityList, onNavigate, onLeadClick }) => (
  <div className="page-content">
    <header className="page-header">
      <h1>Dashboard</h1>
      <p>Your payments pipeline at a glance</p>
    </header>

    <section className="stats-grid">
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">All</span>
          <div className="stat-icon-box"><Target size={16} /></div>
        </div>
        <div className="stat-value">{stats?.totalLeads || 0}</div>
        <div className="stat-subtext">All leads in CRM</div>
        <div className="stat-link">View <ArrowRight size={12} /></div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">New</span>
          <div className="stat-icon-box"><Plus size={16} /></div>
        </div>
        <div className="stat-value">{stats?.newLeads || 0}</div>
        <div className="stat-subtext">Not contacted yet</div>
        <div className="stat-link">View <ArrowRight size={12} /></div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">Contacted</span>
          <div className="stat-icon-box"><MessageSquare size={16} /></div>
        </div>
        <div className="stat-value">{stats?.contactedLeads || 0}</div>
        <div className="stat-subtext">Leads contacted</div>
        <div className="stat-link">View <ArrowRight size={12} /></div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">Visits</span>
          <div className="stat-icon-box"><MapPin size={16} /></div>
        </div>
        <div className="stat-value">{stats?.visits || 0}</div>
        <div className="stat-subtext">Sales visits conducted</div>
        <div className="stat-link">View <ArrowRight size={12} /></div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">Samples</span>
          <div className="stat-icon-box"><Download size={16} /></div>
        </div>
        <div className="stat-value">{stats?.samplesSent || 0}</div>
        <div className="stat-subtext">Total sent</div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">Completed</span>
          <div className="stat-icon-box"><Check size={16} /></div>
        </div>
        <div className="stat-value">{stats?.completedLeads || 0}</div>
        <div className="stat-subtext">Leads completed</div>
        <div className="stat-link">View <ArrowRight size={12} /></div>
      </div>
      <div className="stat-card clickable" onClick={() => onNavigate('Opportunities')}>
        <div className="stat-header">
          <span className="stat-label">Lost</span>
          <div className="stat-icon-box"><X size={16} /></div>
        </div>
        <div className="stat-value">{stats?.lostLeads || 0}</div>
        <div className="stat-subtext">Closed without sale</div>
      </div>
    </section>

    <div className="dashboard-bottom-grid">
      <div className="bottom-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Opportunities</div>
          <div className="card-link" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate('Opportunities')}>View All</div>
        </div>
        <div className="opportunity-list-clean">
          {leads.slice(0, 5).map(lead => (
            <OpportunityItem
              key={lead._id}
              name={lead.companyName}
              contact={lead.contactPerson}
              status={lead.status}
              onClick={() => onLeadClick(lead)}
            />
          ))}
          {leads.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No recent opportunities</p>}
        </div>
      </div>

      <div className="bottom-card">
        <div className="card-header">
          <div className="card-title">Recent Activity</div>
          <Activity size={16} color="#9ca3af" />
        </div>
        <div className="activity-list">
          {activityList.slice(0, 5).map(act => (
            <ActivityItem
              key={act._id}
              user={act.user}
              text={act.text}
              time={new Date(act.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            />
          ))}
          {activityList.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No recent activity</p>}
        </div>
      </div>
    </div>
  </div>
);

const OpportunitiesView = ({ leads, onAdd, onImport, viewMode, setViewMode, onLeadClick, users = [], currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All Users');
  const [myItems, setMyItems] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const allStatuses = ['All', 'New', 'Contacted', 'Visits', 'Samples', 'Completed', 'Lost'];

  // Apply all filters
  const filteredLeads = leads.filter(lead => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = [
        lead.companyName, lead.contactPerson, lead.phoneWhatsApp,
        lead.postcode, lead.businessType, lead.cityArea, lead.email
      ].some(field => field && field.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    // Status filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'New' && lead.status !== 'New Lead') return false;
      if (statusFilter === 'Contacted' && lead.status !== 'Contacted') return false;
      if (statusFilter === 'Visits' && lead.contactMethod !== 'Visit') return false;
      if (statusFilter === 'Samples' && lead.status !== 'Sample / Price Sent') return false;
      if (statusFilter === 'Completed' && lead.status !== 'Completed') return false;
      if (statusFilter === 'Lost' && lead.status !== 'Lost Lead') return false;
    }
    // User filter
    if (userFilter !== 'All Users') {
      const ownerName = lead.leadOwner?.name || '';
      if (ownerName !== userFilter) return false;
    }
    // My Items filter
    if (myItems && currentUser) {
      const ownerId = lead.leadOwner?._id || lead.leadOwner;
      if (ownerId !== currentUser._id) return false;
    }
    return true;
  });

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleClick = () => { setShowStatusDropdown(false); setShowUserDropdown(false); };
    if (showStatusDropdown || showUserDropdown) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showStatusDropdown, showUserDropdown]);

  return (
    <div className="page-content">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Opportunities</h1>
          <p>Manage your payment opportunities pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={onImport}><Upload size={16} /> Import CSV</button>
          <button className="btn-primary" onClick={onAdd}><Plus size={16} /> Add Opportunity</button>
        </div>
      </header>

      <div className="lead-stepper-container" style={{ paddingBottom: '1.5rem', marginBottom: '1rem', marginTop: '1rem' }}>
        <div className="lead-stepper">
          <div className="step-line"></div>
          <div className="step-line-active" style={{ width: `${(allStatuses.indexOf(statusFilter) / (allStatuses.length - 1)) * 100}%` }}></div>
          {allStatuses.map((s, i) => (
            <div
              key={s}
              className={`step-item ${i <= allStatuses.indexOf(statusFilter) ? 'active' : ''} ${s === 'Lost' && statusFilter === 'Lost' ? 'lost' : ''}`}
              onClick={() => setStatusFilter(s)}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              <div className="step-dot">{i + 1}</div>
              <span className="step-label">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-search">
          <Search size={16} color="#94a3b8" />
          <input type="text" placeholder="Search by name, phone, postcode..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* User Filter */}
          <div className="dropdown-container">
            <button className="filter-dropdown" onClick={e => { e.stopPropagation(); setShowUserDropdown(!showUserDropdown); setShowStatusDropdown(false); }}>
              <UserCircle size={16} />
              <span>{userFilter}</span>
              <ChevronDown size={14} />
            </button>
            {showUserDropdown && (
              <div className="custom-dropdown" onClick={e => e.stopPropagation()}>
                <div className={`dropdown-item ${userFilter === 'All Users' ? 'active' : ''}`} onClick={() => { setUserFilter('All Users'); setShowUserDropdown(false); }}>
                  {userFilter === 'All Users' && <Check size={16} />}
                  <span style={{ marginLeft: userFilter === 'All Users' ? '0' : '26px' }}>All Users</span>
                </div>
                {users.map(u => (
                  <div key={u._id} className={`dropdown-item ${userFilter === u.name ? 'active' : ''}`} onClick={() => { setUserFilter(u.name); setShowUserDropdown(false); }}>
                    {userFilter === u.name && <Check size={16} />}
                    <span style={{ marginLeft: userFilter === u.name ? '0' : '26px' }}>{u.name} ({u.role})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Items Toggle */}
          <button className={`btn-secondary ${myItems ? 'active' : ''}`} style={{ padding: '0 1rem', height: '38px', background: myItems ? '#2563eb' : '', color: myItems ? '#fff' : '', borderColor: myItems ? '#2563eb' : '' }} onClick={() => setMyItems(!myItems)}>My Items</button>

          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Grid size={16} /></button>
            <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /></button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>Business <BarChart3 size={12} className="sort-icon" /></th>
                <th>Contact <BarChart3 size={12} className="sort-icon" /></th>
                <th>Phone <BarChart3 size={12} className="sort-icon" /></th>
                <th>Postcode <BarChart3 size={12} className="sort-icon" /></th>
                <th>Status <BarChart3 size={12} className="sort-icon" /></th>
                <th>BDA</th>
                <th>BDM</th>
                <th>Callback <BarChart3 size={12} className="sort-icon" /></th>
                <th>Provider <BarChart3 size={12} className="sort-icon" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(opp => (
                <TableRow
                  key={opp._id}
                  business={opp.companyName}
                  contact={opp.contactPerson}
                  phone={opp.phoneWhatsApp}
                  postcode={opp.postcode || '—'}
                  status={opp.status}
                  bda={opp.leadOwner?.name || '—'}
                  bdm={['BDM', 'Admin'].includes(opp.leadOwner?.role) ? opp.leadOwner.name : '—'}
                  callback={opp.nextFollowUpDate ? new Date(opp.nextFollowUpDate).toLocaleDateString() : '—'}
                  provider={opp.topCompetitorBrandName || '—'}
                  onClick={() => onLeadClick(opp)}
                />
              ))}
            </tbody>
          </table>
          {filteredLeads.length === 0 && <p style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>No leads match your filters.</p>}
        </div>
      ) : (
        <div className="opportunities-grid-container">
          {filteredLeads.map(opp => (
            <div
              key={opp._id}
              className="opportunity-grid-card"
              onClick={() => onLeadClick(opp)}
              style={{ cursor: 'pointer' }}
            >
              <div className="grid-card-header">
                <div className="grid-card-main">
                  <h3 className="grid-card-title">{opp.companyName}</h3>
                  <div className="grid-card-meta">
                    <span>{opp.contactPerson}</span>
                    <span>{opp.postcode}</span>
                  </div>
                </div>
                <span className={`status-badge-${(opp.status || 'new').toLowerCase().replace(/[\s/]+/g, '')}`}>{opp.status || 'New Lead'}</span>
              </div>
              <div className="grid-card-content">
                <div className="grid-info-row">
                  <Phone size={14} className="grid-icon" />
                  <span className="grid-phone">{opp.phoneWhatsApp}</span>
                </div>
                {opp.topCompetitorBrandName && (
                  <div className="grid-info-row">
                    <span className="grid-label">Competitor:</span>
                    <span className="grid-value">{opp.topCompetitorBrandName}</span>
                  </div>
                )}
                <div className="grid-team-box">
                  <div className="grid-team-row">
                    <span className="grid-label">Owner:</span>
                    <span className="grid-value">{opp.leadOwner?.name || '—'}</span>
                  </div>
                </div>
                <div className="grid-callback-row">
                  <span className="grid-label">Follow-up:</span>
                  <span className="grid-value">{opp.nextFollowUpDate ? new Date(opp.nextFollowUpDate).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && <p style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>No leads match your filters.</p>}
        </div>
      )}

      <div className="pagination-bar">
        <div className="pagination-info">Showing {filteredLeads.length} of {leads.length} results</div>
      </div>
    </div>
  );
};

const AccountsView = ({ leads, onImport, viewMode, setViewMode, onLeadClick }) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  return (
    <div className="page-content">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Accounts</h1>
          <p>{leads.filter(l => l.status === 'Active Customer / Repeat Order').length} repeat customers, {leads.length} total active accounts</p>
        </div>
        <button className="btn-secondary" onClick={onImport}><Upload size={16} /> Import CSV</button>
      </header>

      <div className="filters-bar">
        <div className="filter-search">
          <Search size={16} color="#94a3b8" />
          <input type="text" placeholder="Search accounts..." />
        </div>

        <div className="tab-toggle">
          {['All', 'Orders', 'Delivery', 'Payment', 'Repeat'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="dropdown-container">
            <button className="filter-dropdown" onClick={() => setShowUserDropdown(!showUserDropdown)}>
              <Filter size={16} />
              <span>All Users</span>
              <ChevronDown size={14} />
            </button>
            {showUserDropdown && (
              <div className="custom-dropdown">
                <div className="dropdown-item active"><Check size={16} /> All Users</div>
              </div>
            )}
          </div>

          <button className="btn-secondary" style={{ padding: '0 1rem', height: '38px' }}>My Items</button>
          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Grid size={16} /></button>
            <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /></button>
          </div>
        </div>
      </div>

      {(() => {
        const filteredLeads = leads.filter(l => {
          if (activeTab === 'All') return true;
          if (activeTab === 'Orders') return l.status === 'Order Confirmed';
          if (activeTab === 'Delivery') return ['Delivery Scheduled', 'Delivered'].includes(l.status);
          if (activeTab === 'Payment') return ['Payment Pending', 'Payment Received'].includes(l.status);
          if (activeTab === 'Repeat') return l.status === 'Active Customer / Repeat Order';
          return true;
        });

        return viewMode === 'list' ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Postcode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(acc => (
                  <AccountRow
                    key={acc._id}
                    business={acc.companyName}
                    contact={acc.contactPerson}
                    phone={acc.phoneWhatsApp}
                    postcode={acc.postcode}
                    status={acc.status}
                    onClick={() => onLeadClick(acc)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="accounts-grid-container">
            {filteredLeads.map(acc => (
              <div key={acc._id} className="account-grid-card" onClick={() => onLeadClick(acc)} style={{ cursor: 'pointer' }}>
                <div className="account-grid-header">
                  <div className="account-card-main">
                    <h3 className="account-card-title">{acc.companyName}</h3>
                    <div className="account-card-contact">{acc.contactPerson}</div>
                  </div>
                  <span className={`status-badge-${acc.status.toLowerCase().replace(/[\s/]+/g, '')}`}>{acc.status}</span>
                </div>
                <div className="account-card-body">
                  <div className="account-info-row">
                    <Phone size={14} className="grid-icon" />
                    <span>{acc.phoneWhatsApp}</span>
                  </div>
                  <div className="account-info-row">
                    <Building size={14} className="grid-icon" />
                    <span>{acc.postcode}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

const ContactView = ({ leads, onLeadClick }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const accountStatuses = ['Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending', 'Payment Received', 'Active Customer / Repeat Order'];

  const filteredContacts = leads.filter(l => {
    const isOpportunity = !accountStatuses.includes(l.status);
    const isAccount = accountStatuses.includes(l.status);
    if (activeTab === 'Opportunities' && !isOpportunity) return false;
    if (activeTab === 'Accounts' && !isAccount) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (l.companyName?.toLowerCase().includes(query) || l.contactPerson?.toLowerCase().includes(query) || l.phoneWhatsApp?.toLowerCase().includes(query));
    }
    return true;
  });

  return (
    <div className="page-content">
      <header className="page-header">
        <h1>Contact</h1>
        <p>{filteredContacts.length} contacts across {activeTab.toLowerCase()}</p>
      </header>

      <div className="filters-bar">
        <div className="filter-search">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tab-toggle">
          {['All', 'Opportunities', 'Accounts'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="contact-list">
        {filteredContacts.map(l => (
          <ContactCard
            key={l._id}
            initial={l.contactPerson ? l.contactPerson[0] : '?'}
            name={l.contactPerson || 'Unknown Contact'}
            business={l.companyName}
            phone={l.phoneWhatsApp}
            type={accountStatuses.includes(l.status) ? 'Account' : 'Opportunity'}
            onClick={() => onLeadClick(l)}
          />
        ))}
        {filteredContacts.length === 0 && <p style={{ color: '#9ca3af' }}>No contacts found.</p>}
      </div>
    </div>
  );
};

const getCallbackDate = (lead) => {
  if (!lead) return null;
  if (lead.nextFollowUpDate) {
    const parsed = new Date(lead.nextFollowUpDate);
    if (!isNaN(parsed)) return parsed;
  }

  if (!lead.callback) return null;
  const callbackText = lead.callback.trim();
  const lower = callbackText.toLowerCase();
  if (lower.includes('today')) return new Date();
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  const parsed = new Date(callbackText);
  if (!isNaN(parsed)) return parsed;

  const dateMatch = callbackText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
    const fallback = new Date(year, month, day);
    if (!isNaN(fallback)) return fallback;
  }

  return null;
};

const getLeadName = (lead) => lead?.companyName || lead?.business || 'Unnamed lead';
const getLeadContact = (lead) => lead?.contactPerson || lead?.contactName || 'No contact';
const getLeadPhone = (lead) => lead?.phoneWhatsApp || lead?.phone || 'No phone';

const formatCallbackTime = (lead) => {
  const date = getCallbackDate(lead);
  if (date) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return lead.callback || 'Scheduled';
};

const formatCallbackDate = (lead) => {
  const date = getCallbackDate(lead);
  if (date) {
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return lead.callback || 'Scheduled';
};

const isSameDay = (a, b) => {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const CalendarView = ({ leads }) => {
  const [calendarMode, setCalendarMode] = useState('Month');
  const today = new Date();

  // Auto-detect best initial month: nearest callback month (prefer future, fallback to past)
  const getInitialViewDate = () => {
    const callbackDates = leads
      .map(l => getCallbackDate(l))
      .filter(Boolean)
      .sort((a, b) => a - b);

    if (callbackDates.length === 0) return new Date();

    // Check if any callbacks exist in current month
    const hasCurrentMonth = callbackDates.some(d =>
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
    );
    if (hasCurrentMonth) return new Date();

    // Find nearest future callback
    const futureCallbacks = callbackDates.filter(d => d >= today);
    if (futureCallbacks.length > 0) return futureCallbacks[0];

    // Fallback: nearest past callback
    return callbackDates[callbackDates.length - 1];
  };

  const [viewDate, setViewDate] = useState(getInitialViewDate);

  const callbacksToday = leads.filter(l => {
    const callbackDate = getCallbackDate(l);
    return isSameDay(callbackDate, today);
  });

  const goToToday = () => setViewDate(new Date());

  const navigateMonth = (delta) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const navigateDay = (delta) => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  return (
    <div className="page-content">
      {/* Alert Banner */}
      {callbacksToday.length > 0 && (
        <div className="calendar-alert-banner">
          <Bell size={18} />
          <div className="alert-content">
            <div className="alert-title">You have {callbacksToday.length} callback{callbacksToday.length > 1 ? 's' : ''} today</div>
            {callbacksToday.slice(0, 2).map(l => (
              <div key={l._id} className="alert-item"><Phone size={14} /> {getLeadName(l)}</div>
            ))}
          </div>
        </div>
      )}

      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Calendar</h1>
          <p>Manage scheduled appointments and callbacks</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-secondary" style={{ padding: '0 1rem', height: '38px' }} onClick={goToToday}>Today</button>
          <div className="tab-toggle">
            {['Month', 'Day', 'List'].map(mode => (
              <button
                key={mode}
                className={`tab-btn ${calendarMode === mode ? 'active' : ''}`}
                onClick={() => setCalendarMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </header>

      {calendarMode === 'Month' && <CalendarMonthView leads={leads} viewDate={viewDate} onNavigate={navigateMonth} />}
      {calendarMode === 'Day' && <CalendarDayView leads={leads} viewDate={viewDate} onNavigate={navigateDay} />}
      {calendarMode === 'List' && <CalendarListView leads={leads} />}
    </div>
  );
};

const UsersView = ({ users, onImport, onAdd, onEdit, onResetPassword, onDeactivate, onDelete }) => {
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const roles = ['All Roles', 'Agent', 'Manager'];

  const filteredUsers = roleFilter === 'All Roles'
    ? users
    : users.filter(u => {
      if (roleFilter === 'Agent') return u.role === 'BDA';
      if (roleFilter === 'Manager') return u.role === 'BDM' || u.role === 'Admin';
      return false;
    });

  return (
    <div className="page-content">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Users</h1>
          <p>Manage your team members and their roles</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={onImport}><Upload size={16} /> Import CSV</button>
          <button className="btn-primary" onClick={onAdd}><Plus size={16} /> Add User</button>
        </div>
      </header>

      <div className="filters-bar">
        <div className="filter-search">
          <Search size={16} color="#94a3b8" />
          <input type="text" placeholder="Search users..." />
        </div>
        <div className="dropdown-container">
          <button className="filter-dropdown" onClick={() => setShowRoleDropdown(!showRoleDropdown)}>
            <Filter size={16} />
            <span>{roleFilter}</span>
            <ChevronDown size={14} />
          </button>
          {showRoleDropdown && (
            <div className="custom-dropdown">
              {roles.map(role => (
                <div
                  key={role}
                  className={`dropdown-item ${roleFilter === role ? 'active' : ''}`}
                  onClick={() => {
                    setRoleFilter(role);
                    setShowRoleDropdown(false);
                  }}
                >
                  {roleFilter === role && <Check size={16} />}
                  <span style={{ marginLeft: roleFilter === role ? '0' : '26px' }}>{role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="users-grid">
        {filteredUsers.map(u => (
          <UserCard
            key={u._id}
            user={u}
            initials={u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            name={u.name}
            handle={u.handle || `@${u.name.toLowerCase().replace(' ', '.')}`}
            email={u.email}
            role={u.isOwner ? 'Owner' : (u.role === 'BDA' ? 'Agent' : 'Manager')}
            status={u.status}
            onEdit={onEdit}
            onReset={onResetPassword}
            onDeactivate={onDeactivate}
            onDelete={onDelete}
          />
        ))}
        {filteredUsers.length === 0 && <p style={{ color: '#9ca3af', padding: '2rem' }}>No users found for this role.</p>}
      </div>
    </div>
  );
};

const UserCard = ({ user, initials, name, handle, email, phone, role, status, onEdit, onReset, onDeactivate, onDelete }) => (
  <div className={`user-card ${status === 'inactive' ? 'inactive' : ''}`}>
    <div className="user-card-header">
      <div className="user-card-avatar">{initials}</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {status === 'inactive' && <span className="status-tag inactive">Inactive</span>}
        <span className={`role-badge ${role.toLowerCase()}`}>{role}</span>
      </div>
    </div>
    <div className="user-card-body">
      <div className="user-card-name">{name}</div>
      <div className="user-card-handle">{handle}</div>
      <div className="user-card-contact">
        <div className="contact-item"><Mail size={14} /> {email}</div>
        {phone && <div className="contact-item"><Phone size={14} /> {phone}</div>}
      </div>
    </div>
    <div className="user-card-footer">
      <button className="user-action-btn" title="Edit User" onClick={() => onEdit(user)}><Edit3 size={16} /></button>
      <button
        className={`user-action-btn ${status === 'inactive' ? 'active' : ''}`}
        title={status === 'inactive' ? 'Activate User' : 'Deactivate User'}
        onClick={() => onDeactivate(user)}
      >
        <UserX size={16} />
      </button>
      <button className="user-action-btn" title="Reset Password" onClick={() => onReset(user)}><Key size={16} /></button>
      <button className="user-action-btn delete" title="Delete User" onClick={() => onDelete(user)}><Trash2 size={16} /></button>
    </div>
  </div>
);

const CalendarMonthView = ({ leads, viewDate, onNavigate }) => {
  const today = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthName = monthStart.toLocaleString(undefined, { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (monthStart.getDay() + 6) % 7; // Align Monday as first column
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const leadsWithCallbacks = leads.filter(l => getCallbackDate(l));

  return (
    <div className="calendar-container">
      <div className="calendar-nav-header">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)}><ChevronLeft size={20} /></button>
        <h2>{monthName} {year}</h2>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)}><ChevronRight size={20} /></button>
      </div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="cal-weekday">{day}</div>
        ))}

        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNumber = idx - startWeekday + 1;
          const isVisible = dayNumber > 0 && dayNumber <= daysInMonth;
          const date = isVisible ? new Date(year, month, dayNumber) : null;
          const dayLeads = isVisible
            ? leadsWithCallbacks.filter(l => isSameDay(getCallbackDate(l), date))
            : [];

          return (
            <div key={idx} className={`cal-day-cell ${isVisible && isSameDay(date, today) ? 'today' : ''}`}>
              {isVisible ? (
                <>
                  <span className="day-num">{dayNumber}</span>
                  {dayLeads.map(l => (
                    <CalendarPill
                      key={l._id}
                      color="mint"
                      label={`${formatCallbackTime(l)} · ${getLeadName(l)}`}
                    />
                  ))}
                </>
              ) : <span className="day-num" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CalendarDayView = ({ leads, viewDate, onNavigate }) => {
  const today = new Date();
  const dayLeads = leads.filter(l => isSameDay(getCallbackDate(l), viewDate));
  const isToday = isSameDay(viewDate, today);

  return (
    <div className="calendar-container">
      <div className="calendar-nav-header">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)}><ChevronLeft size={20} /></button>
        <h2>{viewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{isToday ? ' (Today)' : ''}</h2>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)}><ChevronRight size={20} /></button>
      </div>
      <div className="day-schedule-list">
        {dayLeads.map(l => (
          <div key={l._id} className="day-event-card">
            <div className="event-accent"></div>
            <div className="event-info">
              <div className="event-header">
                <Phone size={18} color="#10b981" />
                <span className="event-title">{getLeadName(l)}</span>
                <span className="status-badge approved" style={{ background: '#dcfce7', color: '#059669' }}>Callback</span>
              </div>
              <div className="event-meta">
                <div className="meta-item"><Clock size={14} /> {formatCallbackTime(l)}</div>
                <div className="meta-item"><Phone size={14} /> {getLeadPhone(l)}</div>
              </div>
            </div>
          </div>
        ))}
        {dayLeads.length === 0 && <p style={{ color: '#9ca3af', padding: '1rem' }}>No callbacks on this day.</p>}
      </div>
    </div>
  );
};

const CalendarListView = ({ leads }) => {
  const leadsWithCallbacks = leads.filter(l => getCallbackDate(l));

  return (
    <div className="calendar-list-workspace">
      <div className="filters-bar">
        <div className="filter-search">
          <Search size={16} color="#94a3b8" />
          <input type="text" placeholder="Search entries..." />
        </div>
        <div className="dropdown-container">
          <button className="filter-dropdown">
            <Filter size={16} />
            <span>All Status</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="appointment-list">
        {leadsWithCallbacks.map(l => (
          <AppointmentCard
            key={l._id}
            name={getLeadName(l)}
            type="Callback"
            contact={getLeadContact(l)}
            bdm={l.bdm}
            time={formatCallbackDate(l)}
          />
        ))}
        {leadsWithCallbacks.length === 0 && <p style={{ color: '#9ca3af' }}>No scheduled callbacks or appointments.</p>}
      </div>
    </div>
  );
};

const CalendarPill = ({ color, label }) => (
  <div className={`cal-pill ${color}`}>{label}</div>
);

const AppointmentCard = ({ name, type, contact, bdm, time }) => (
  <div className="appointment-card">
    <div className="app-accent"></div>
    <div className="app-main">
      <div className="app-header">
        <span className="app-title">{name}</span>
        <span className="app-type">{type}</span>
      </div>
      <div className="app-details">
        <div>{contact}</div>
        <div className="bdm-label">BDM: {bdm}</div>
      </div>
    </div>
    <div className="app-right">
      <div className="app-time"><Clock size={14} /> {time}</div>
      <span className="app-status">scheduled</span>
      <button className="btn-secondary"><Eye size={16} /> View Lead</button>
      <button className="btn-primary"><Target size={16} /> Convert</button>
    </div>
  </div>
);

const ContactCard = ({ initial, name, business, phone, type }) => (
  <div className="contact-card">
    <div className="contact-avatar">{initial}</div>
    <div className="contact-main">
      <div className="contact-name">{name || business}</div>
      <div className="contact-business">
        <Building size={14} color="#94a3b8" />
        <span>{business}</span>
      </div>
    </div>
    <div className="contact-right">
      {phone && (
        <div className="contact-phone">
          <Phone size={14} />
          <span>{phone}</span>
        </div>
      )}
      <span className="status-badge approved">{type}</span>
    </div>
  </div>
);

const AccountRow = ({ business, contact, phone, postcode, status, volume, mid }) => (
  <tr>
    <td className="business-cell">{business}</td>
    <td className="contact-cell">{contact}</td>
    <td className="phone-cell">
      {phone} <Copy size={12} className="copy-icon" />
    </td>
    <td>{postcode}</td>
    <td><span className="status-badge approved">{status}</span></td>
    <td>{volume}</td>
    <td>{mid}</td>
  </tr>
);

const AddOpportunityModal = ({ onClose, onSuccess, authHeaders, users = [] }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    businessType: '',
    contactPerson: '',
    phoneWhatsApp: '',
    email: '',
    cityArea: '',
    postcode: '',
    leadOwner: '',
    interestedProducts: [],
    leadSource: '',
    supplier: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter users who can be assigned as BDA (BDA or BDM role)
  const assignableUsers = users.filter(u => u.role === 'BDA' || u.role === 'BDM');

  const businessTypes = [
    'Retail Shop', 'Cash & Carry', 'Wholesaler', 'Distributor',
    'Restaurant / Café', 'Supermarket', 'Online Store', 'Event Buyer',
    'Hotel', 'Catering Company', 'Gym / Sports Club', 'Other'
  ];

  const leadSources = ['Website', 'Cold Call', 'Sales Visit', 'Referral', 'Social Media', 'Personal Friend', 'Enquiry', 'Other'];

  const products = ['ALL', 'COLA', 'STRAWBERRY', 'ORANGE', 'MANGO', 'COLA ZERO'];

  const validate = () => {
    const newErrors = {};
    if (!formData.companyName.trim()) newErrors.companyName = true;
    if (!formData.businessType) newErrors.businessType = true;
    if (!formData.cityArea.trim()) newErrors.cityArea = true;

    // Phone validation (at least 10 characters)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!formData.phoneWhatsApp.trim() || !phoneRegex.test(formData.phoneWhatsApp)) newErrors.phoneWhatsApp = true;

    // Email validation (optional but must be valid if provided)
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) newErrors.email = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setGeneralError('');
    if (!validate()) {
      setGeneralError('Please fill in all required fields correctly.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const newLead = await res.json();
        onSuccess(newLead);
        onClose();
      } else {
        const errorText = await res.text();
        let errorMessage = 'Failed to create lead. Please try again.';

        if (errorText.includes('Duplicate lead found')) {
          errorMessage = 'A lead with this Company Name or Phone number already exists.';
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
        }
        setGeneralError(errorMessage);
      }
    } catch (e) {
      console.error('Error creating lead:', e);
      setGeneralError('Connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (product) => {
    setFormData(prev => {
      let nextProducts;
      if (product === 'ALL') {
        const allSelected = prev.interestedProducts.includes('ALL');
        nextProducts = allSelected ? [] : ['ALL', 'COLA', 'STRAWBERRY', 'ORANGE', 'MANGO', 'COLA ZERO'];
      } else {
        const isCurrentlySelected = prev.interestedProducts.includes(product);
        let updated;
        if (isCurrentlySelected) {
          updated = prev.interestedProducts.filter(p => p !== product && p !== 'ALL');
        } else {
          updated = [...prev.interestedProducts, product];
        }
        
        // Check if all actual products are now selected
        const actualProducts = ['COLA', 'STRAWBERRY', 'ORANGE', 'MANGO', 'COLA ZERO'];
        const hasAllActual = actualProducts.every(ap => updated.includes(ap));
        
        if (hasAllActual) {
          nextProducts = ['ALL', ...updated.filter(p => p !== 'ALL')];
        } else {
          nextProducts = updated.filter(p => p !== 'ALL');
        }
      }
      return {
        ...prev,
        interestedProducts: nextProducts
      };
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Add New Lead</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body-scrollable">
          {generalError && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              border: '1px solid #fee2e2'
            }}>
              {generalError}
            </div>
          )}
          <div className="form-grid">
            <div className={`form-field ${errors.companyName ? 'error' : ''}`}>
              <label>Company / Shop Name *</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>
            <div className={`form-field ${errors.businessType ? 'error' : ''}`}>
              <label>Business Type *</label>
              <select
                className="form-select"
                value={formData.businessType}
                onChange={e => setFormData({ ...formData, businessType: e.target.value })}
              >
                <option value="">Select Type</option>
                {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Contact Name</label>
              <input type="text" value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
            </div>
            <div className={`form-field ${errors.phoneWhatsApp ? 'error' : ''}`}>
              <label>Phone / WhatsApp *</label>
              <input
                type="text"
                value={formData.phoneWhatsApp}
                onChange={e => setFormData({ ...formData, phoneWhatsApp: e.target.value })}
              />
            </div>
            <div className={`form-field ${errors.email ? 'error' : ''}`}>
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className={`form-field ${errors.cityArea ? 'error' : ''}`}>
              <label>City / Area *</label>
              <input
                type="text"
                value={formData.cityArea}
                onChange={e => setFormData({ ...formData, cityArea: e.target.value })}
              />
            </div>
            <div className={`form-field ${errors.postcode ? 'error' : ''}`}>
              <label>Postcode *</label>
              <input
                type="text"
                value={formData.postcode}
                onChange={e => setFormData({ ...formData, postcode: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Assign to BDA</label>
              <select
                className="form-select"
                value={formData.leadOwner}
                onChange={e => setFormData({ ...formData, leadOwner: e.target.value })}
              >
                <option value="">Current User (Default)</option>
                {assignableUsers.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="form-field full-width">
              <label>Interested Products</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {products.map(p => (
                  <button
                    key={p}
                    className={`btn-secondary ${formData.interestedProducts.includes(p) ? 'active' : ''}`}
                    onClick={() => toggleProduct(p)}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: formData.interestedProducts.includes(p) ? '#dcfce7' : '' }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>Lead Source</label>
              <select className="form-select" value={formData.leadSource} onChange={e => setFormData({ ...formData, leadSource: e.target.value })}>
                <option value="">Select Source</option>
                {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Current Supplier</label>
              <input
                type="text"
                placeholder="e.g. Red Bull, Lucozade..."
                value={formData.supplier}
                onChange={e => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>
            <div className="form-field full-width">
              <label>Notes</label>
              <textarea rows="4" placeholder="Additional details..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw size={16} className="animate-spin" /> : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SearchPopup = ({ leads, users, onLeadClick, onClose }) => {
  const [query, setQuery] = useState('');

  const leadsResults = leads.filter(l =>
    (l.companyName && l.companyName.toLowerCase().includes(query.toLowerCase())) ||
    (l.contactPerson && l.contactPerson.toLowerCase().includes(query.toLowerCase())) ||
    (l.postcode && l.postcode.toLowerCase().includes(query.toLowerCase()))
  ).map(l => ({
    id: l._id,
    type: ['Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending', 'Payment Received', 'Active Customer / Repeat Order'].includes(l.status) ? 'Account' : 'Opportunity',
    title: l.companyName,
    subtitle: `${l.contactPerson || ''} • ${l.postcode || ''}`,
    icon: ['Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending', 'Payment Received', 'Active Customer / Repeat Order'].includes(l.status) ? 'Building2' : 'Target',
    original: l
  }));

  const usersResults = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  ).map(u => ({
    id: u._id,
    type: 'User',
    title: u.name,
    subtitle: u.role,
    icon: 'UserCircle',
    original: u
  }));

  const results = query.length >= 2 ? [...leadsResults, ...usersResults] : [];

  return (
    <div className="search-popup-overlay" onClick={onClose}>
      <div className="search-popup-card" onClick={e => e.stopPropagation()}>
        <div className="search-popup-header">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search opportunities, accounts, users..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="search-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="search-popup-body">
          {query.length < 2 ? (
            <div className="search-empty-state">
              <p>Type at least 2 characters to search...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="search-results-list">
              {results.map(result => (
                <div key={result.id} className="search-result-item" onClick={() => {
                  if (result.type !== 'User') onLeadClick(result.original);
                  else onClose();
                }}>
                  <div className="result-icon">
                    {result.icon === 'Target' && <Target size={18} />}
                    {result.icon === 'Building2' && <Building2 size={18} />}
                    {result.icon === 'UserCircle' && <UserCircle size={18} />}
                  </div>
                  <div className="result-info">
                    <div className="result-title">{result.title}</div>
                    <div className="result-subtitle">{result.subtitle}</div>
                  </div>
                  <div className="result-type">{result.type}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <p>No results found for "{query}"</p>
            </div>
          )}
        </div>
        {query.length >= 2 && results.length > 0 && (
          <div className="search-popup-footer">
            Showing {results.length} results
          </div>
        )}
      </div>
    </div>
  );
};

const UserModal = ({ mode, user, onClose, onSuccess, authHeaders, currentUser }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'BDA',
    handle: user?.handle || '',
    phone: user?.phone || ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = true;
    if (!formData.handle.trim()) newErrors.handle = true;
    if (mode === 'add' && (!formData.password || formData.password.length < 8)) newErrors.password = true;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) newErrors.email = true;

    // Phone validation (at least 10 characters)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone)) newErrors.phone = true;

    if (!formData.role) newErrors.role = true;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setGeneralError('');
    if (!validate()) {
      setGeneralError('Please fill in all required fields correctly.');
      return;
    }
    try {
      const url = mode === 'add' ? '/api/users' : `/api/users/${user._id}`;
      const method = mode === 'add' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const savedUser = await res.json();
        onSuccess(savedUser);
        onClose();
      } else {
        const errorText = await res.text();
        let errorMessage = 'Failed to save user. Please try again.';

        if (errorText.includes('E11000') && errorText.includes('email')) {
          errorMessage = 'A user with this email address already exists.';
        } else if (errorText.includes('E11000')) {
          errorMessage = 'A duplicate entry was found. Please check your data.';
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
        }
        setGeneralError(errorMessage);
      }
    } catch (e) {
      console.error('Error saving user:', e);
      setGeneralError('Connection error. Please check your network and try again.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            {mode === 'add' ? 'Add Team Member' : 'Edit Team Member'}
          </h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {generalError && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
              border: '1px solid #fee2e2'
            }}>
              {generalError}
            </div>
          )}
          <div className="form-grid">
            <div className={`form-field ${errors.name ? 'error' : ''}`}>
              <label>Full Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. John Doe" />
            </div>
            <div className={`form-field ${errors.handle ? 'error' : ''}`}>
              <label>Username / Handle *</label>
              <input type="text" value={formData.handle} onChange={e => setFormData({ ...formData, handle: e.target.value })} placeholder="@username" />
            </div>
            {mode === 'add' && (
              <div className={`form-field ${errors.password ? 'error' : ''}`}>
                <label>Password * (min. 8 chars)</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="eye-button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
            <div className={`form-field ${errors.role ? 'error' : ''}`}>
              <label>Role *</label>
              <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                <option value="BDA">BDA (Agent)</option>
                {currentUser?.isOwner && <option value="BDM">BDM (Manager)</option>}
              </select>
            </div>
            <div className={`form-field ${errors.email ? 'error' : ''}`}>
              <label>Email *</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className={`form-field ${errors.phone ? 'error' : ''}`}>
              <label>Phone *</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ borderTop: 'none', padding: '0 1.5rem 1.5rem' }}>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '44px' }} onClick={handleSave}>
            {mode === 'add' ? 'Create User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ResetPasswordModal = ({ user, onClose, authHeaders }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (newPassword.length < 6) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => onClose(), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Reset Password</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Setting a new password for <span style={{ color: '#1e293b', fontWeight: 700 }}>{user?.name}</span>.
          </p>

          <div className="form-field">
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                style={{ paddingRight: '4rem' }}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem',
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {success && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#dcfce7',
              color: '#15803d',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <Check size={16} /> Password reset successfully!
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ borderTop: 'none', gap: '1rem', padding: '0 1.5rem 1.5rem' }}>
          <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', background: '#60a5fa' }}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportLeadsModal = ({ onClose, type, onSuccess, authHeaders }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const templates = {
    leads: { name: 'Opportunities Template', file: '/leads_template.csv' },
    accounts: { name: 'Accounts Template', file: '/accounts_template.csv' },
    users: { name: 'Users Template', file: '/users_template.csv' }
  };
  const currentTemplate = templates[type] || templates.leads;

  const businessTypeEnum = [
    'Retail Shop', 'Cash & Carry', 'Wholesaler', 'Distributor',
    'Restaurant / Café', 'Supermarket', 'Online Store', 'Event Buyer',
    'Hotel', 'Catering Company', 'Gym / Sports Club', 'Other'
  ];

  const mapIndustryToBusinessType = (industry) => {
    if (!industry) return 'Other';
    const found = businessTypeEnum.find(b =>
      b.toLowerCase().includes(industry.toLowerCase()) ||
      industry.toLowerCase().includes(b.toLowerCase())
    );
    return found || 'Other';
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          throw new Error('CSV file is empty or missing data rows');
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const data = lines.slice(1).map(line => {
          const values = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const obj = {};
          headers.forEach((header, i) => {
            let val = values[i] || '';
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }
            obj[header] = val;
          });
          return obj;
        });

        const endpoint = type === 'users' ? '/api/users' : '/api/leads';
        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
          const payload = type === 'users' ? {
            name: item.full_name || item.name || '',
            email: item.email || '',
            role: item.role ? (item.role.toUpperCase() === 'ADMIN' ? 'BDM' : item.role.toUpperCase()) : 'BDA',
            handle: item.username ? (item.username.startsWith('@') ? item.username : '@' + item.username) : '',
            phone: item.phone || '',
            password: item.password || 'password123'
          } : {
            companyName: item.company_name || item.companyname || item.company_shop_name || item.business_name || item.business || '',
            businessType: mapIndustryToBusinessType(item.business_type || item.businesstype || item.industry || ''),
            contactPerson: item.contact_person || item.contactperson || item.contact_name || item.contact || '',
            phoneWhatsApp: item.phone_whatsapp || item.phonewhatsapp || item.contact_phone || item.phone || '',
            email: item.email || item.contact_email || '',
            cityArea: item.city_area || item.cityarea || item.town_city || item.area || 'Unknown',
            postcode: item.postcode || '',
            interestedProducts: item.interested_products
              ? item.interested_products.split(/[;,]/).map(p => p.trim().toUpperCase()).filter(Boolean)
              : [],
            leadSource: item.lead_source || item.leadsource || '',
            supplier: item.supplier || item.current_supplier || '',
            status: type === 'accounts' ? (item.status || 'Active Customer / Repeat Order') : 'New Lead',
            notes: item.notes || '',
            topCompetitorBrandName: item.top_competitor_brand_name || item.topcompetitorbrandname || item.current_provider || item.provider || ''
          };

          // Basic validation for required fields
          if (type !== 'users' && (!payload.companyName || !payload.phoneWhatsApp)) {
            console.warn('Skipping row — missing companyName or phoneWhatsApp:', item);
            failCount++;
            continue;
          }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            const errData = await res.json().catch(() => ({}));
            console.error('Failed to import row:', payload.companyName, errData.error || res.statusText);
          }
        }

        await fetch('/api/activity', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            user: 'System',
            text: `Imported ${successCount} records into ${type}${failCount > 0 ? ` (${failCount} failed)` : ''}`
          })
        });

        if (successCount === 0 && data.length > 0) {
          throw new Error(
            `Failed to import any records. Check:\n\u2022 Required columns: company_name, phone_whatsapp, city_area\n\u2022 No duplicate company names or phone numbers\n\u2022 Valid business_type value`
          );
        }

        if (failCount > 0) {
          setError(`Imported ${successCount} of ${data.length} records. ${failCount} row(s) failed \u2014 likely duplicates or missing required fields.`);
          onSuccess();
          return; // Keep modal open so user sees the warning
        }

        onSuccess();
        onClose();
      } catch (err) {
        console.error('Import failed:', err);
        setError(err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Import {type === 'leads' ? 'Opportunities' : type.charAt(0).toUpperCase() + type.slice(1)}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="import-dropzone" style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
            <Upload size={32} color={file ? "#10b981" : "#2563eb"} />
            <h3>{file ? file.name : "Click or drag CSV file here"}</h3>
            <p>{file ? "File ready to import" : "Support for .csv"}</p>
          </div>
          {error && (
            <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', border: '1px solid #fee2e2' }}>
              {error}
            </div>
          )}
          <div className="template-box">
            <div className="template-info">
              <FileText size={20} color="#64748b" />
              <div>
                <h4>{currentTemplate.name}</h4>
                <p>Download our template to ensure correct mapping.</p>
              </div>
            </div>
            <a href={currentTemplate.file} download className="btn-download" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Download size={16} /> Download
            </a>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? "Importing..." : "Start Import"}
          </button>
        </div>
      </div>
    </div>
  );
};

const TableRow = ({ business, contact, phone, postcode, status, bda, bdm, callback, provider, onClick }) => (
  <tr onClick={onClick} style={{ cursor: 'pointer' }}>
    <td><input type="checkbox" /></td>
    <td className="business-cell">{business}</td>
    <td className="contact-cell">{contact}</td>
    <td className="phone-cell">
      {phone} {phone !== '—' && <Copy size={12} className="copy-icon" />}
    </td>
    <td>{postcode}</td>
    <td><span className={`status-badge-${(status || 'new').toLowerCase().replace(/[\s/]+/g, '')}`}>{status || 'New Lead'}</span></td>
    <td className="team-cell">{bda}</td>
    <td className="team-cell">{bdm}</td>
    <td>{callback}</td>
    <td className="provider-cell">{provider}</td>
  </tr>
);

const TeamMember = ({ name }) => (
  <div className="team-member">
    <div className="status-dot"></div>
    <span>{name}</span>
  </div>
);

const PipelineStep = ({ num, label }) => (
  <div className="pipeline-step-v2">
    <div className="pipeline-num-v2">{num}</div>
    <div className="pipeline-label-v2">{label}</div>
  </div>
);

const OpportunityItem = ({ name, contact, status, onClick }) => (
  <div className="opportunity-item-clean" onClick={onClick} style={{ cursor: 'pointer' }}>
    <div className="opp-info">
      <div className="opp-business-name">{name}</div>
      <div className="opp-contact-name">{contact}</div>
    </div>
    <div className={`status-badge-${(status || 'new').toLowerCase().replace(/[\s/]+/g, '')}`}>{status || 'New Lead'}</div>
  </div>
);

const LeadDetailsView = ({ lead, onBack, onSuccess, onDelete, onNavigateToOpportunities, authHeaders, users = [], activityList = [] }) => {
  const statuses = [
    'New Lead', 'Contacted', 'Qualified Lead', 'Sample / Price Sent',
    'Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending',
    'Payment Received', 'Active Customer / Repeat Order', 'Completed', 'Lost Lead'
  ];

  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingWorkflow, setIsEditingWorkflow] = useState(false);
  const [showWorkflowPopup, setShowWorkflowPopup] = useState(false);
  const [popupMode, setPopupMode] = useState('');
  const [popupError, setPopupError] = useState('');
  const [contactForm, setContactForm] = useState({
    companyName: lead?.companyName || '',
    contactPerson: lead?.contactPerson || '',
    phoneWhatsApp: lead?.phoneWhatsApp || '',
    email: lead?.email || '',
    cityArea: lead?.cityArea || '',
    postcode: lead?.postcode || '',
    businessType: lead?.businessType || '',
    supplier: lead?.supplier || '',
    leadOwner: lead?.leadOwner?._id || lead?.leadOwner || ''
  });
  const [contactErrors, setContactErrors] = useState({});
  const [generalContactError, setGeneralContactError] = useState('');

  const [workflowForm, setWorkflowForm] = useState({
    dateContacted: lead?.dateContacted ? new Date(lead.dateContacted).toISOString().slice(0, 16) : '',
    contactMethod: lead?.contactMethod || '',
    response: lead?.response || '',
    nextFollowUpDate: lead?.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : '',
    sellsCompetitorBrands: lead?.sellsCompetitorBrands || '',
    topCompetitorBrandName: lead?.topCompetitorBrandName || '',
    usualOrderQuantity: lead?.usualOrderQuantity || '',
    isCurrentContactDecisionMaker: lead?.isCurrentContactDecisionMaker || '',
    decisionMakerName: lead?.decisionMakerName || '',
    decisionMakerContactNumber: lead?.decisionMakerContactNumber || '',
    decisionMaker: lead?.decisionMaker || '',
    needsSamplePricing: lead?.needsSamplePricing || '',
    requiredNextStep: lead?.requiredNextStep || '',
    lostReason: lead?.lostReason || '',
    priceListSent: lead?.priceListSent || '',
    sampleDelivered: lead?.sampleDelivered || '',
    sampleDeliveryDate: lead?.sampleDeliveryDate ? new Date(lead.sampleDeliveryDate).toISOString().split('T')[0] : '',
    catalogueSent: lead?.catalogueSent || '',
    companyProfileSent: lead?.companyProfileSent || '',
    customerAgreed: lead?.customerAgreed || '',
    reasonForDecision: lead?.reasonForDecision || '',
    customerFeedback: lead?.customerFeedback || '',
    deliveryDate: lead?.deliveryDate ? new Date(lead.deliveryDate).toISOString().split('T')[0] : '',

    // Conditional next steps fields
    visitScheduledDate: lead?.visitScheduledDate ? new Date(lead.visitScheduledDate).toISOString().slice(0, 16) : '',
    otoRef: lead?.otoRef || '',
    otoOrderId: lead?.otoOrderId || '',
    trackingId: lead?.trackingId || '',
    sampleRecipientName: lead?.sampleRecipientName || '',
    sampleAddress: lead?.sampleAddress || '',
    samplePostcode: lead?.samplePostcode || '',
    sampleContactNo: lead?.sampleContactNo || '',
    status: lead?.status || 'New Lead'
  });

  const handleUpdateWorkflow = (updates) => {
    setIsEditingWorkflow(true);
    setWorkflowForm(prev => ({ ...prev, ...updates }));
  };

  const handleResponseSelection = (value) => {
    handleUpdateWorkflow({ response: value });
    if (['Interested', 'No Response', 'Not Interested'].includes(value)) {
      setPopupMode(value);
      setPopupError('');
      setShowWorkflowPopup(true);
    } else {
      setShowWorkflowPopup(false);
      setPopupMode('');
      setPopupError('');
    }
  };

  const handleCloseWorkflowPopup = () => {
    setShowWorkflowPopup(false);
    setPopupError('');
    setPopupMode('');
  };

  const saveWorkflowState = async ({ payload = null, afterSave = () => { } } = {}) => {
    setUpdating(true);
    try {
      let bodyPayload = payload || { ...workflowForm };

      // Auto-determine status if saving the whole form or if not already in payload
      if (!bodyPayload.status) {
        const currentStatus = lead.status || 'New Lead';
        const currentIdx = statuses.indexOf(currentStatus);
        let nextStatus = currentStatus;

        if (workflowForm.response === 'No Response' && currentIdx < 1) {
          nextStatus = 'Contacted';
        } else if (workflowForm.response === 'Not Interested') {
          nextStatus = 'Lost Lead';
        } else if (workflowForm.response === 'Interested') {
          if (currentIdx < 2) nextStatus = 'Qualified Lead';
          if (workflowForm.requiredNextStep === 'Send distributor details') {
            nextStatus = 'Completed';
          } else if (
            (workflowForm.priceListSent === 'Yes' ||
              workflowForm.sampleDelivered === 'Yes' ||
              workflowForm.requiredNextStep === 'Send Samples') &&
            currentIdx < 3
          ) {
            nextStatus = 'Sample / Price Sent';
          }
        }

        if (nextStatus !== currentStatus) {
          bodyPayload.status = nextStatus;
        }
      }

      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsEditingWorkflow(false);
        onSuccess(data);
        afterSave();
        return true;
      }
      const message = data.error || data.message || `Save failed (${res.status})`;
      setPopupError(message);
      console.error('Workflow save failed:', res.status, data);
    } catch (e) {
      setPopupError('Unable to save workflow data.');
      console.error('Workflow save error:', e);
    } finally {
      setUpdating(false);
    }
    return false;
  };

  const buildPopupPatch = () => {
    const patch = {
      response: workflowForm.response,
      dateContacted: workflowForm.dateContacted,
      contactMethod: workflowForm.contactMethod
    };

    const currentStatus = lead.status || 'New Lead';
    const currentIdx = statuses.indexOf(currentStatus);

    if (popupMode === 'No Response') {
      if (currentIdx < 1) patch.status = 'Contacted';
      if (workflowForm.nextFollowUpDate) patch.nextFollowUpDate = workflowForm.nextFollowUpDate;
    }

    if (popupMode === 'Not Interested') {
      patch.status = 'Lost Lead';
      if (workflowForm.lostReason) patch.lostReason = workflowForm.lostReason;
    }

    if (popupMode === 'Interested') {
      let nextStatus = currentStatus;
      if (currentIdx < 2) nextStatus = 'Qualified Lead';

      if (
        workflowForm.priceListSent === 'Yes' ||
        workflowForm.sampleDelivered === 'Yes' ||
        workflowForm.requiredNextStep === 'Send distributor details' ||
        workflowForm.requiredNextStep === 'Send Samples'
      ) {
        if (currentIdx < 3) nextStatus = 'Sample / Price Sent';
      }

      if (nextStatus !== currentStatus) patch.status = nextStatus;

      const fields = [
        'sellsCompetitorBrands',
        'topCompetitorBrandName',
        'isCurrentContactDecisionMaker',
        'decisionMakerName',
        'decisionMakerContactNumber',
        'decisionMaker',
        'usualOrderQuantity',
        'needsSamplePricing',
        'requiredNextStep',
        'priceListSent',
        'sampleDelivered',
        'sampleDeliveryDate',
        'catalogueSent',
        'companyProfileSent',
        'customerAgreed',
        'reasonForDecision',
        'customerFeedback',
        'visitScheduledDate',
        'otoRef',
        'otoOrderId',
        'trackingId',
        'sampleRecipientName',
        'sampleAddress',
        'samplePostcode',
        'sampleContactNo'
      ];
      fields.forEach(field => {
        if (workflowForm[field] !== undefined && workflowForm[field] !== null && workflowForm[field] !== '') {
          patch[field] = workflowForm[field];
        }
      });
      if (workflowForm.customerAgreed === 'Pending' && workflowForm.nextFollowUpDate) {
        patch.nextFollowUpDate = workflowForm.nextFollowUpDate;
      }
    }

    return patch;
  };

  const handleSaveWorkflowPopup = async () => {
    setPopupError('');

    if (popupMode === 'No Response' && !workflowForm.nextFollowUpDate) {
      setPopupError('Please select a next follow-up date.');
      return;
    }

    if (popupMode === 'Not Interested' && !workflowForm.lostReason) {
      setPopupError('Please select a reason for not interested.');
      return;
    }

    if (popupMode === 'Interested') {
      if (workflowForm.requiredNextStep === 'Schedule Visit') {
        if (!workflowForm.visitScheduledDate) {
          setPopupError('Please select a visit date and time.');
          return;
        }
      } else if (workflowForm.requiredNextStep === 'Send Samples') {
        if (!workflowForm.otoRef || !workflowForm.otoRef.trim()) {
          setPopupError('Please enter OTO Ref.');
          return;
        }
        if (!workflowForm.otoOrderId || !workflowForm.otoOrderId.trim()) {
          setPopupError('Please enter OTO Order ID.');
          return;
        }
        if (!workflowForm.sampleRecipientName || !workflowForm.sampleRecipientName.trim()) {
          setPopupError('Please enter Recipient Name.');
          return;
        }
        if (!workflowForm.sampleAddress || !workflowForm.sampleAddress.trim()) {
          setPopupError('Please enter Shipping Address.');
          return;
        }
        if (!workflowForm.samplePostcode || !workflowForm.samplePostcode.trim()) {
          setPopupError('Please enter Postal Code.');
          return;
        }
      }
    }

    const shouldClose = () => {
      setShowWorkflowPopup(false);
      setPopupMode('');
      if (onNavigateToOpportunities) onNavigateToOpportunities();
    };

    const payload = buildPopupPatch();
    const success = await saveWorkflowState({ payload, afterSave: shouldClose });
    if (!success) {
      return;
    }
  };

  React.useEffect(() => {
    if (!isEditingWorkflow && lead) {
      setWorkflowForm({
        dateContacted: lead.dateContacted ? new Date(lead.dateContacted).toISOString().slice(0, 16) : '',
        contactMethod: lead.contactMethod || '',
        response: lead.response || '',
        nextFollowUpDate: lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : '',
        sellsCompetitorBrands: lead.sellsCompetitorBrands || '',
        topCompetitorBrandName: lead.topCompetitorBrandName || '',
        usualOrderQuantity: lead.usualOrderQuantity || '',
        isCurrentContactDecisionMaker: lead.isCurrentContactDecisionMaker || '',
        decisionMakerName: lead.decisionMakerName || '',
        decisionMakerContactNumber: lead.decisionMakerContactNumber || '',
        decisionMaker: lead.decisionMaker || '',
        needsSamplePricing: lead.needsSamplePricing || '',
        requiredNextStep: lead.requiredNextStep || '',
        lostReason: lead.lostReason || '',
        priceListSent: lead.priceListSent || '',
        sampleDelivered: lead.sampleDelivered || '',
        sampleDeliveryDate: lead.sampleDeliveryDate ? new Date(lead.sampleDeliveryDate).toISOString().split('T')[0] : '',
        catalogueSent: lead.catalogueSent || '',
        companyProfileSent: lead.companyProfileSent || '',
        customerAgreed: lead.customerAgreed || '',
        reasonForDecision: lead.reasonForDecision || '',
        customerFeedback: lead.customerFeedback || '',
        deliveryDate: lead.deliveryDate ? new Date(lead.deliveryDate).toISOString().split('T')[0] : ''
      });
    }

    if (!isEditingContact && lead) {
      setContactForm({
        companyName: lead?.companyName || '',
        contactPerson: lead?.contactPerson || '',
        phoneWhatsApp: lead?.phoneWhatsApp || '',
        email: lead?.email || '',
        cityArea: lead?.cityArea || '',
        postcode: lead?.postcode || '',
        businessType: lead?.businessType || '',
        leadOwner: lead?.leadOwner?._id || lead?.leadOwner || ''
      });
    }
  }, [lead, isEditingContact]);

  // Filter users who can be assigned as BDA (BDA or BDM role)
  const assignableUsers = users.filter(u => u.role === 'BDA' || u.role === 'BDM');

  if (!lead) return null;

  const validateContact = () => {
    const newErrors = {};
    if (!contactForm.companyName.trim()) newErrors.companyName = true;
    if (!contactForm.businessType) newErrors.businessType = true;
    if (!contactForm.cityArea.trim()) newErrors.cityArea = true;

    // Phone validation (at least 10 characters)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!contactForm.phoneWhatsApp.trim() || !phoneRegex.test(contactForm.phoneWhatsApp)) newErrors.phoneWhatsApp = true;

    // Email validation (optional)
    if (contactForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactForm.email)) newErrors.email = true;
    }

    setContactErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateStatus = async (newStatus, extraFields = {}) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus, ...extraFields })
      });
      if (res.ok) {
        const updated = await res.json();
        onSuccess(updated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${lead.companyName}?`)) return;
    try {
      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        if (onDelete) onDelete();
        onBack();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveContact = async () => {
    setGeneralContactError('');
    if (!validateContact()) {
      setGeneralContactError('Please fix the errors below.');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(contactForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setIsEditingContact(false);
        onSuccess(updated);
      } else {
        const errorText = await res.text();
        setGeneralContactError(errorText || 'Failed to update contact.');
      }
    } catch (e) {
      console.error(e);
      setGeneralContactError('Connection error.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    try {
      const res = await fetch('/api/activity', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          user: 'User',
          text: note,
          lead: lead._id
        })
      });
      if (res.ok) {
        const newActivity = await res.json();
        setNote('');
        // Notes don't change lead data, just refresh activity list
        onSuccess(null); // triggers activity refresh in parent
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentIndex = statuses.indexOf(lead.status || 'New Lead');

  const isOnVisitOrSampleStage = lead.status === 'Sample / Price Sent' || 
                                 workflowForm.requiredNextStep === 'Schedule Visit' || 
                                 workflowForm.requiredNextStep === 'Send Samples' || 
                                 lead.requiredNextStep === 'Schedule Visit' || 
                                 lead.requiredNextStep === 'Send Samples';

  return (
    <div className="page-content">
      <header className="lead-details-header">
        <div className="lead-header-left">
          <button className="back-btn-circle" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <div className="lead-title-group">
            <h2>{lead.companyName}</h2>
            <p>{lead.contactPerson} • {lead.cityArea}</p>
          </div>
        </div>
        <div className="lead-header-right">
          <span className={`status-badge-${(lead.status || 'new').toLowerCase().replace(/[\s/]+/g, '')}`} style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
            {lead.status || 'New Lead'}
          </span>
          <button className="trash-btn" onClick={handleDelete} title="Delete Lead"><Trash2 size={20} /></button>
        </div>
      </header>

      <div className="lead-grid-cols">
        <div className="details-column">
          <div className="details-card">
            <div className="card-title-row">
              <h3>Company Info</h3>
              {isEditingContact ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button className="btn-secondary" style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.75rem' }} onClick={() => { setIsEditingContact(false); setContactErrors({}); setGeneralContactError(''); }}>Cancel</button>
                  <button className="btn-save-mini" onClick={handleSaveContact} disabled={updating}>
                    {updating ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <Edit3 size={18} color="#6b7280" style={{ cursor: 'pointer' }} onClick={() => setIsEditingContact(true)} />
              )}
            </div>
            {generalContactError && (
              <div style={{ color: '#dc2626', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '1rem', border: '1px solid #fee2e2' }}>
                {generalContactError}
              </div>
            )}
            <div className="contact-info-list">
              <div className={`contact-info-item ${contactErrors.companyName ? 'error' : ''}`}>
                <Building size={18} />
                {isEditingContact ? (
                  <input
                    type="text"
                    className={contactErrors.companyName ? 'error' : ''}
                    value={contactForm.companyName}
                    onChange={e => setContactForm({ ...contactForm, companyName: e.target.value })}
                  />
                ) : (
                  <span>{lead.companyName}</span>
                )}
              </div>
              <div className={`contact-info-item ${contactErrors.businessType ? 'error' : ''}`}>
                <Target size={18} />
                {isEditingContact ? (
                  <select
                    className={`form-select ${contactErrors.businessType ? 'error' : ''}`}
                    value={contactForm.businessType}
                    onChange={e => setContactForm({ ...contactForm, businessType: e.target.value })}
                  >
                    {['Retail Shop', 'Cash & Carry', 'Wholesaler', 'Distributor', 'Restaurant / Café', 'Supermarket', 'Online Store', 'Event Buyer', 'Hotel', 'Catering Company', 'Gym / Sports Club', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <span>{lead.businessType}</span>
                )}
              </div>
              <div className="contact-info-item">
                <User size={18} />
                {isEditingContact ? (
                  <input type="text" value={contactForm.contactPerson} onChange={e => setContactForm({ ...contactForm, contactPerson: e.target.value })} />
                ) : (
                  <span>{lead.contactPerson || 'No contact person'}</span>
                )}
              </div>
              <div className={`contact-info-item ${contactErrors.phoneWhatsApp ? 'error' : ''}`}>
                <Phone size={18} />
                {isEditingContact ? (
                  <input
                    type="text"
                    className={contactErrors.phoneWhatsApp ? 'error' : ''}
                    value={contactForm.phoneWhatsApp}
                    onChange={e => setContactForm({ ...contactForm, phoneWhatsApp: e.target.value })}
                  />
                ) : (
                  <span>{lead.phoneWhatsApp}</span>
                )}
              </div>
              <div className={`contact-info-item ${contactErrors.email ? 'error' : ''}`}>
                <Mail size={18} />
                {isEditingContact ? (
                  <input
                    type="email"
                    className={contactErrors.email ? 'error' : ''}
                    value={contactForm.email}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                ) : (
                  <span>{lead.email || 'No email'}</span>
                )}
              </div>
              <div className={`contact-info-item ${contactErrors.cityArea ? 'error' : ''}`}>
                <Building2 size={18} />
                {isEditingContact ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className={contactErrors.cityArea ? 'error' : ''}
                      placeholder="City"
                      value={contactForm.cityArea}
                      onChange={e => setContactForm({ ...contactForm, cityArea: e.target.value })}
                    />
                    <input
                      type="text"
                      className={contactErrors.postcode ? 'error' : ''}
                      placeholder="Postcode"
                      value={contactForm.postcode}
                      onChange={e => setContactForm({ ...contactForm, postcode: e.target.value })}
                    />
                  </div>
                ) : (
                  <span>{lead.cityArea} {lead.postcode ? `(${lead.postcode})` : ''}</span>
                )}
              </div>
              <div className="contact-info-item">
                <UserCircle size={18} />
                {isEditingContact ? (
                  <select
                    className="form-select"
                    value={contactForm.leadOwner}
                    onChange={e => setContactForm({ ...contactForm, leadOwner: e.target.value })}
                  >
                    <option value="">Current User (Default)</option>
                    {assignableUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                ) : (
                  <span>Assigned to: {lead.leadOwner?.name || 'Self'}</span>
                )}
              </div>
              <div className="contact-info-item">
                <Building size={18} />
                {isEditingContact ? (
                  <input
                    type="text"
                    placeholder="Current Supplier (e.g. Red Bull)"
                    value={contactForm.supplier}
                    onChange={e => setContactForm({ ...contactForm, supplier: e.target.value })}
                  />
                ) : (
                  <span>Supplier: {lead.supplier || '—'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="details-card" style={{ marginTop: '1.5rem' }}>
            <div className="card-title-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#2563eb" />
                Workflow Stages
              </h3>
            </div>

            {/* Stage: Contacted */}
            <div className="workflow-section">
              <h4>1. Contact Information</h4>
              <div className="form-grid-mini">
                <div className="form-field">
                  <label>Date Contacted</label>
                  <CustomDatePicker type="datetime-local" value={workflowForm.dateContacted} onChange={e => handleUpdateWorkflow({ dateContacted: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Method</label>
                  <select value={workflowForm.contactMethod} onChange={e => handleUpdateWorkflow({ contactMethod: e.target.value })}>
                    <option value="">Select Method</option>
                    {['Call', 'WhatsApp', 'Visit', 'Email'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Response</label>
                  <select value={workflowForm.response} onChange={e => handleResponseSelection(e.target.value)}>
                    <option value="">Select Response</option>
                    {['Interested', 'No Response', 'Not Interested'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>



            {workflowForm.response === 'Not Interested' && lead.status !== 'Lost Lead' && !showWorkflowPopup && (
              <div className="workflow-section">
                <h4>2. Close Opportunity</h4>
                <div className="form-field">
                  <label>Mark as Lost?</label>
                  <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fee2e2', width: '100%' }} onClick={() => { setShowWorkflowPopup(true); setPopupMode('Not Interested'); setPopupError(''); }}>
                    Move to Lost Lead
                  </button>
                </div>
              </div>
            )}

            {/* Stage Outcome for Visit or Sample Stage */}
            {isOnVisitOrSampleStage && (
              <div className="workflow-section" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                <h4>Stage Outcome</h4>
                <div className="form-grid-mini">
                  <div className="form-field" style={{ gridColumn: 'span 2' }}>
                    <label>Mark Stage Outcome</label>
                    <select
                      value={workflowForm.status === 'Completed' ? 'Completed' : (workflowForm.status === 'Lost Lead' ? 'Lost' : '')}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'Completed') {
                          handleUpdateWorkflow({ status: 'Completed' });
                        } else if (val === 'Lost') {
                          handleUpdateWorkflow({ status: 'Lost Lead' });
                        } else {
                          handleUpdateWorkflow({ status: lead.status });
                        }
                      }}
                    >
                      <option value="">Select Outcome</option>
                      <option value="Completed">Completed (Won)</option>
                      <option value="Lost">Lost Lead</option>
                    </select>
                  </div>
                  {workflowForm.status === 'Lost Lead' && (
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label>Reason for Lost Lead</label>
                      <select value={workflowForm.lostReason} onChange={e => handleUpdateWorkflow({ lostReason: e.target.value })}>
                        <option value="">Select Reason</option>
                        {['Already has supplier', 'Delivery area issue', 'Low demand', 'Competitor gave better deal', 'Price issue', 'Wrong contact details', 'Not selling soft drinks', 'Not interested at the moment', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}


            {currentIndex >= 4 && currentIndex <= 9 && (
              <div className="workflow-section">
                <h4>{currentIndex >= 7 ? '4. Payment & Completion' : '3. Order & Delivery'}</h4>
                <div className="form-grid-mini">
                  <div className="form-field">
                    <label>Order Status</label>
                    <span className="status-tag active" style={{ display: 'inline-block', marginTop: '8px' }}>{lead.status}</span>
                  </div>
                  {currentIndex >= 5 && (
                    <div className="form-field">
                      <label>Delivery Date</label>
                      <CustomDatePicker type="date" value={workflowForm.deliveryDate} onChange={e => handleUpdateWorkflow({ deliveryDate: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={saveWorkflowState}
                disabled={updating}
                style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}
              >
                {updating ? 'Saving...' : 'Save Workflow Details'}
              </button>
            </div>
          </div>
        </div>

        {showWorkflowPopup && (
          <div className="modal-overlay" onClick={handleCloseWorkflowPopup}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{popupMode === 'Interested' ? 'Interested Details' : popupMode === 'No Response' ? 'Schedule Follow Up' : 'Not Interested Reason'}</h2>
                <button className="modal-close" onClick={handleCloseWorkflowPopup}><X size={20} /></button>
              </div>
              <div className="modal-body-scrollable">
                {popupError && <div style={{ color: '#b91c1c', marginBottom: '1rem' }}>{popupError}</div>}
                {popupMode === 'No Response' && (
                  <div className="form-grid-mini">
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label>Next Follow Up</label>
                      <CustomDatePicker type="datetime-local" value={workflowForm.nextFollowUpDate} onChange={e => handleUpdateWorkflow({ nextFollowUpDate: e.target.value })} />
                    </div>
                  </div>
                )}

                {popupMode === 'Not Interested' && (
                  <div className="form-grid-mini">
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label>Reason for not interested</label>
                      <select value={workflowForm.lostReason} onChange={e => handleUpdateWorkflow({ lostReason: e.target.value })}>
                        <option value="">Select Reason</option>
                        {['Already has supplier', 'Delivery area issue', 'Low demand', 'Competitor gave better deal', 'Price issue', 'Wrong contact details', 'Not selling soft drinks', 'Not interested at the moment', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {popupMode === 'Interested' && (
                  <>
                    <div className="workflow-section">
                      <h4>Qualification</h4>
                      <div className="form-grid-mini">
                        <div className="form-field">
                          <label>Sells Competitors?</label>
                          <select value={workflowForm.sellsCompetitorBrands} onChange={e => handleUpdateWorkflow({ sellsCompetitorBrands: e.target.value })}>
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        {workflowForm.sellsCompetitorBrands === 'Yes' && (
                          <div className="form-field">
                            <label>Competitor Brand</label>
                            <input type="text" value={workflowForm.topCompetitorBrandName} onChange={e => handleUpdateWorkflow({ topCompetitorBrandName: e.target.value })} />
                          </div>
                        )}
                        <div className="form-field">
                          <label>Decision Maker?</label>
                          <select value={workflowForm.isCurrentContactDecisionMaker} onChange={e => handleUpdateWorkflow({ isCurrentContactDecisionMaker: e.target.value })}>
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        {workflowForm.isCurrentContactDecisionMaker === 'No' && (
                          <>
                            <div className="form-field">
                              <label>Decision Maker Name</label>
                              <input type="text" value={workflowForm.decisionMakerName} onChange={e => handleUpdateWorkflow({ decisionMakerName: e.target.value })} />
                            </div>
                            <div className="form-field">
                              <label>Decision Maker Phone</label>
                              <input type="text" value={workflowForm.decisionMakerContactNumber} onChange={e => handleUpdateWorkflow({ decisionMakerContactNumber: e.target.value })} />
                            </div>
                          </>
                        )}
                        <div className="form-field">
                          <label>Usual Quantity</label>
                          <input type="text" value={workflowForm.usualOrderQuantity} placeholder="e.g. 50 cases/month" onChange={e => handleUpdateWorkflow({ usualOrderQuantity: e.target.value })} />
                        </div>
                        <div className="form-field">
                          <label>Next Step</label>
                          <select value={workflowForm.requiredNextStep} onChange={e => handleUpdateWorkflow({ requiredNextStep: e.target.value })}>
                            <option value="">Select Next Step</option>
                            {['Send distributor details', 'Send Samples', 'Schedule Visit'].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    {workflowForm.requiredNextStep === 'Schedule Visit' && (
                      <div className="workflow-section">
                        <h4>Schedule Visit Details</h4>
                        <div className="form-grid-mini">
                          <div className="form-field">
                            <label>Visit Date & Time *</label>
                            <CustomDatePicker
                              type="datetime-local"
                              value={workflowForm.visitScheduledDate}
                              onChange={e => handleUpdateWorkflow({ visitScheduledDate: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {workflowForm.requiredNextStep === 'Send Samples' && (
                      <div className="workflow-section">
                        <h4>Sample Shipping Details</h4>
                        <div className="form-grid-mini">
                          <div className="form-field">
                            <label>OTO Ref *</label>
                            <input
                              type="text"
                              value={workflowForm.otoRef}
                              placeholder="OTO Reference Number"
                              onChange={e => handleUpdateWorkflow({ otoRef: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>OTO Order ID *</label>
                            <input
                              type="text"
                              value={workflowForm.otoOrderId}
                              placeholder="OTO Order ID"
                              onChange={e => handleUpdateWorkflow({ otoOrderId: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Tracking ID</label>
                            <input
                              type="text"
                              value={workflowForm.trackingId}
                              placeholder="Courier Tracking ID (optional)"
                              onChange={e => handleUpdateWorkflow({ trackingId: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Name *</label>
                            <input
                              type="text"
                              value={workflowForm.sampleRecipientName}
                              placeholder="Recipient Name"
                              onChange={e => handleUpdateWorkflow({ sampleRecipientName: e.target.value })}
                            />
                          </div>
                          <div className="form-field" style={{ gridColumn: 'span 2' }}>
                            <label>Address *</label>
                            <input
                              type="text"
                              value={workflowForm.sampleAddress}
                              placeholder="Full Shipping Address"
                              onChange={e => handleUpdateWorkflow({ sampleAddress: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Postal Code *</label>
                            <input
                              type="text"
                              value={workflowForm.samplePostcode}
                              placeholder="e.g. SE1 7PB"
                              onChange={e => handleUpdateWorkflow({ samplePostcode: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Contact No</label>
                            <input
                              type="text"
                              value={workflowForm.sampleContactNo}
                              placeholder="Contact Phone Number"
                              onChange={e => handleUpdateWorkflow({ sampleContactNo: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="btn-secondary" onClick={handleCloseWorkflowPopup}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveWorkflowPopup} disabled={updating}>{updating ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="actions-column">
          <div className="details-card">
            <div className="card-title-row" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                <FileText size={18} color="#2563eb" />
                Qualification & Next Step Details
              </h3>
            </div>
            
            <div className="qualification-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600, width: '45%' }}>Sells Competitors?</td>
                    <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.sellsCompetitorBrands || '—'}</td>
                  </tr>
                  {lead.sellsCompetitorBrands === 'Yes' && (
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Competitor Brand</td>
                      <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.topCompetitorBrandName || '—'}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Decision Maker?</td>
                    <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.isCurrentContactDecisionMaker || '—'}</td>
                  </tr>
                  {lead.isCurrentContactDecisionMaker === 'No' && (
                    <>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Decision Maker Name</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.decisionMakerName || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Decision Maker Phone</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.decisionMakerContactNumber || '—'}</td>
                      </tr>
                    </>
                  )}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Usual Order Quantity</td>
                    <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.usualOrderQuantity || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Required Next Step</td>
                    <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>
                      {lead.requiredNextStep ? (
                        <span className="status-badge-completed" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                          {lead.requiredNextStep}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                  {lead.requiredNextStep === 'Schedule Visit' && (
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Visit Date & Time</td>
                      <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>
                        {lead.visitScheduledDate ? new Date(lead.visitScheduledDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  )}
                  {lead.requiredNextStep === 'Send Samples' && (
                    <>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>OTO Ref</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.otoRef || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>OTO Order ID</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.otoOrderId || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Tracking ID</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.trackingId || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Recipient Name</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.sampleRecipientName || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Shipping Address</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700, wordBreak: 'break-word' }}>{lead.sampleAddress || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Postal Code</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.samplePostcode || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Contact No</td>
                        <td style={{ padding: '8px 0', color: '#1e293b', fontWeight: 700 }}>{lead.sampleContactNo || '—'}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="activity-history-card" style={{ marginTop: '1.5rem' }}>
            <div className="card-title-row">
              <h3>Activity & Notes</h3>
            </div>
            <div className="note-input-container">
              <textarea
                className="note-textarea"
                placeholder="Add a note..."
                value={note}
                onChange={e => setNote(e.target.value)}
              ></textarea>
              <button className="note-send-btn" onClick={handleAddNote}>
                <MessageSquare size={18} />
              </button>
            </div>
            <div className="history-timeline">
              {activityList.filter(a => a.lead === lead._id).map(act => (
                <div key={act._id} className="history-item">
                  <div className="history-dot"></div>
                  <div className="history-content">
                    <div className="history-text"><span style={{ fontWeight: 600 }}>{act.user}</span>: {act.text}</div>
                    <div className="history-time">{new Date(act.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {activityList.filter(a => a.lead === lead._id).length === 0 && (
                <div className="history-item">
                  <div className="history-dot"></div>
                  <div className="history-content">
                    <div className="history-text">Lead created and set to: {lead.status || 'New Lead'}</div>
                    <div className="history-time">{new Date(lead.createdAt || lead.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityItem = ({ user, text, time }) => (
  <div className="activity-item">
    <div className="activity-dot"></div>
    <div className="activity-info">
      <div className="activity-text"><span style={{ fontWeight: 800 }}>{user}</span>: {text}</div>
      <div className="activity-time">{time}</div>
    </div>
  </div>
);

const NotificationsPopup = ({ activity, onClose, onNavigate, onMarkAllRead }) => {
  return (
    <div className="notifications-popup" onClick={e => e.stopPropagation()}>
      <div className="notifications-header">
        <h3>Notifications</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="mark-read-btn" onClick={onMarkAllRead}>Mark all as read</button>
          <button className="btn-icon-only" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      <div className="notifications-list">
        {activity.slice(0, 5).map(n => (
          <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`}>
            <div className="notification-avatar">
              {n.user === 'System' ? <Activity size={14} /> : (n.user ? n.user[0] : '?')}
            </div>
            <div className="notification-content">
              <div className="notification-text">
                <span className="user-name">{n.user}</span> {n.text}
              </div>
              <div className="notification-time">{new Date(n.createdAt).toLocaleTimeString()}</div>
            </div>
            {!n.isRead && <div className="unread-dot"></div>}
          </div>
        ))}
        {activity.length === 0 && <p style={{ padding: '1rem', color: '#9ca3af' }}>No recent activity.</p>}
      </div>
      <div className="notifications-footer" onClick={() => {
        onNavigate();
        onClose();
      }}>
        View all notifications
      </div>
    </div>
  );
};

const NotificationsView = ({ activity, onMarkAllRead, onDelete }) => {
  return (
    <div className="page-content">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Notifications</h1>
          <p>Stay updated with the latest CRM activity</p>
        </div>
        <button className="btn-secondary" onClick={onMarkAllRead}>Mark all as read</button>
      </header>

      <div className="notifications-page-list">
        {activity.map(n => (
          <div key={n._id} className={`notification-page-item ${!n.isRead ? 'unread' : ''}`}>
            <div className="notif-left">
              <div className="notif-avatar-large">
                {n.user === 'System' ? <Activity size={20} /> : (n.user ? n.user[0] : '?')}
              </div>
              <div className="notif-info">
                <div className="notif-header">
                  <span className="notif-user">{n.user}</span>
                  <span className="notif-type-tag">Activity</span>
                </div>
                <div className="notif-text">{n.text}</div>
                <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="notif-actions">
              <button
                className="btn-icon-only"
                title="Delete Notification"
                onClick={() => onDelete(n._id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {activity.length === 0 && <p style={{ color: '#9ca3af', padding: '2rem' }}>No notifications found.</p>}
      </div>
    </div>
  );
}

export default App;

const LoginPage = ({ onLogin, onSwitchToSignup }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) onLogin(data);
      else setError(data.error || 'Login failed');
    } catch (e) {
      setError('Connection error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Login to your CRM workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label>Email Address</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="form-field">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <div className="auth-error-box">{error}</div>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account? <button className="auth-link" onClick={onSwitchToSignup}>Create a workspace</button>
        </div>
      </div>
    </div>
  );
};

const SignupPage = ({ onSignup, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) onSignup(data);
      else setError(data.error || 'Signup failed');
    } catch (e) {
      setError('Connection error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Workspace</h1>
          <p>Start managing your organization</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label>Full Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
          </div>
          <div className="form-field">
            <label>Workspace / Company Name</label>
            <input type="text" required value={formData.workspaceName} onChange={e => setFormData({ ...formData, workspaceName: e.target.value })} placeholder="Acme Inc." />
          </div>
          <div className="form-field">
            <label>Email Address</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="form-field">
            <label>Password (min. 8 chars)</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength="8"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <div className="auth-error-box">{error}</div>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have a workspace? <button className="auth-link" onClick={onSwitchToLogin}>Sign in</button>
        </div>
      </div>
    </div>
  );
};

// Reusable Custom Premium Date & Time Picker Component with OK/Done Button
const CustomDatePicker = ({ value, onChange, type = 'datetime-local' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);

  // Parse initial state or current value safely
  const parseValue = (val) => {
    const defaultState = {
      year: new Date().getFullYear(),
      month: new Date().getMonth(),
      day: new Date().getDate(),
      hour: 12,
      minute: 0
    };
    if (!val) return defaultState;
    const dateObj = new Date(val);
    if (isNaN(dateObj.getTime())) {
      return defaultState;
    }
    return {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth(),
      day: dateObj.getDate(),
      hour: dateObj.getHours(),
      minute: dateObj.getMinutes()
    };
  };

  const parsed = parseValue(value);
  const [currentYear, setCurrentYear] = useState(parsed.year);
  const [currentMonth, setCurrentMonth] = useState(parsed.month);
  const [selectedDay, setSelectedDay] = useState(value ? parsed.day : null);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);

  // Sync internal state if value changes externally
  React.useEffect(() => {
    if (value) {
      const updated = parseValue(value);
      setCurrentYear(updated.year);
      setCurrentMonth(updated.month);
      setSelectedDay(updated.day);
      setSelectedHour(updated.hour);
      setSelectedMinute(updated.minute);
    } else {
      setSelectedDay(null);
    }
  }, [value]);

  // Click outside listener to close the picker
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleSelectDay = (day, e) => {
    e.stopPropagation();
    setSelectedDay(day);
  };

  const padZero = (num) => String(num).padStart(2, '0');

  const handleOk = (e) => {
    e.stopPropagation();
    const dayVal = selectedDay || new Date().getDate();
    const finalDate = new Date(currentYear, currentMonth, dayVal, selectedHour, selectedMinute);
    
    let formattedVal = '';
    if (type === 'date') {
      formattedVal = `${finalDate.getFullYear()}-${padZero(finalDate.getMonth() + 1)}-${padZero(finalDate.getDate())}`;
    } else {
      formattedVal = `${finalDate.getFullYear()}-${padZero(finalDate.getMonth() + 1)}-${padZero(finalDate.getDate())}T${padZero(finalDate.getHours())}:${padZero(finalDate.getMinutes())}`;
    }

    onChange({ target: { value: formattedVal } });
    setIsOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
    setSelectedHour(today.getHours());
    setSelectedMinute(today.getMinutes());
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedDay(null);
    onChange({ target: { value: '' } });
    setIsOpen(false);
  };

  // Format display value for trigger
  const getDisplayString = () => {
    if (!value) return '';
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) return '';
    
    if (type === 'date') {
      return dateObj.toLocaleDateString(undefined, { dateStyle: 'medium' });
    } else {
      return dateObj.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  };

  // Calendar rendering math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Monday = 0

  const daysGrid = [];
  // Empty slots for start of month
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(<div key={`empty-${i}`} className="datepicker-day empty"></div>);
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = selectedDay === d;
    const isToday = d === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
    daysGrid.push(
      <button
        key={`day-${d}`}
        type="button"
        className={`datepicker-day day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
        onClick={(e) => handleSelectDay(d, e)}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="custom-datepicker-container" ref={containerRef}>
      <div className="datepicker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <input
          type="text"
          readOnly
          placeholder={type === 'date' ? 'Select Date' : 'Select Date & Time'}
          value={getDisplayString()}
          className="datepicker-trigger-input"
        />
        <Calendar size={18} className="datepicker-trigger-icon" />
      </div>

      {isOpen && (
        <div className="datepicker-popover" onClick={(e) => e.stopPropagation()}>
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="datepicker-month-year">{months[currentMonth]} {currentYear}</span>
            <button type="button" className="datepicker-nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="datepicker-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((wd) => (
              <div key={wd} className="datepicker-weekday">{wd}</div>
            ))}
          </div>

          <div className="datepicker-days">
            {daysGrid}
          </div>

          {type === 'datetime-local' && (
            <div className="datepicker-time-picker">
              <div className="datepicker-time-label-row">
                <Clock size={14} />
                <span>Time Selection</span>
              </div>
              <div className="datepicker-time-inputs">
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                  className="datepicker-time-select"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{padZero(h)}</option>
                  ))}
                </select>
                <span className="datepicker-time-separator">:</span>
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                  className="datepicker-time-select"
                >
                  {Array.from({ length: 60 }).map((_, m) => (
                    <option key={m} value={m}>{padZero(m)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="datepicker-footer">
            <div className="datepicker-footer-left">
              <button type="button" className="datepicker-btn-text" onClick={handleToday}>Today</button>
              <button type="button" className="datepicker-btn-text clear" onClick={handleClear}>Clear</button>
            </div>
            <button type="button" className="datepicker-btn-ok" onClick={handleOk}>
              <Check size={14} style={{ marginRight: '4px' }} />
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
