import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all') // all, admin, user
  const [selectedUser, setSelectedUser] = useState(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      setError('')
      
      // Get users from Firestore
      const usersRef = collection(db, 'users')
      const usersSnapshot = await getDocs(usersRef)
      
      const usersList = []
      usersSnapshot.forEach((doc) => {
        usersList.push({
          id: doc.id,
          ...doc.data()
        })
      })
      
      // Sort by creation date (newest first)
      usersList.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
        return bDate - aDate
      })
      
      setUsers(usersList)
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function handleUserClick(user) {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  function closeUserModal() {
    setSelectedUser(null)
    setShowUserModal(false)
  }

  function handleDeleteClick(user) {
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  function closeDeleteModal() {
    setUserToDelete(null)
    setShowDeleteModal(false)
  }

  async function confirmDelete() {
    if (!userToDelete) return
    
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id))
      setUsers(users.filter(user => user.id !== userToDelete.id))
      closeDeleteModal()
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Failed to delete user')
    }
  }

  async function toggleUserRole(user) {
    try {
      const newIsAdmin = !user.isAdmin;
      await updateDoc(doc(db, 'users', user.id), {
        isAdmin: newIsAdmin
      });
      
      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, isAdmin: newIsAdmin } : u
      ));
      
      // Update selected user if it's the same
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser({ ...selectedUser, isAdmin: newIsAdmin });
      }
    } catch (err) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role');
    }
  }

  async function toggleApproval(user) {
    try {
      const newApproved = !user.approved;
      await updateDoc(doc(db, 'users', user.id), {
        approved: newApproved
      });
      
      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, approved: newApproved } : u
      ));
      
      // Update selected user if it's the same
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser({ ...selectedUser, approved: newApproved });
      }
    } catch (err) {
      console.error('Error updating user approval status:', err);
      alert('Failed to update user approval status');
    }
  }

  function formatDate(date) {
    if (!date) return '—'
    const d = date.toDate ? date.toDate() : new Date(date)
    return new Intl.DateTimeFormat(undefined, { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    }).format(d)
  }

  function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return 'No Phone'
    const cleaned = ('' + phoneNumber).replace(/\D/g, '')
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`
    }
    return phoneNumber
  }

  // Filter users based on search term and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.uid?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || 
      (roleFilter === 'admin' && user.isAdmin) ||
      (roleFilter === 'customer' && user.type === 'customer') ||
      (roleFilter === 'driver' && user.type === 'driver') ||
      (roleFilter === 'approved' && user.approved === true) ||
      (roleFilter === 'pending' && user.approved === false)
    
    return matchesSearch && matchesRole
  })

  if (loading) {
    return (
      <main className="main-content">
        <section style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.2rem', color: 'var(--accent-color)' }}>Loading users...</div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-content">
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'black', marginBottom: '0.5rem' }}>User Management</h1>
        <p style={{ color: 'var(--accent-color)', marginBottom: '2rem' }}>
          Manage user accounts, roles, and permissions
        </p>

        {/* Search and Filter Controls */}
        <div className="users-search-form" style={{ 
          display: 'flex', 
          gap: '1rem', 
          flexWrap: 'wrap', 
          alignItems: 'flex-start',
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: 'var(--background-light)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ flex: '2 1 300px', minWidth: '250px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by email, name, or ID..."
              style={{
                padding: '0.75rem 0.6rem',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '1rem',
                minHeight: '44px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '0.75rem 0.6rem',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '1rem',
                minHeight: '44px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">All Users</option>
              <option value="admin">Admins</option>
              <option value="customer">Customers</option>
              <option value="driver">Drivers</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            color: 'var(--accent-color)',
            fontSize: '0.9rem',
            minWidth: '120px'
          }}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </div>
        </div>

        {error && (
          <div style={{ 
            color: 'salmon', 
            backgroundColor: '#ffe6e6', 
            padding: '1rem', 
            borderRadius: '6px', 
            marginBottom: '1rem',
            border: '1px solid #ffcccc'
          }}>
            {error}
          </div>
        )}

        {/* Users List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredUsers.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              color: 'var(--accent-color)',
              backgroundColor: 'var(--background-light)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              {searchTerm || roleFilter !== 'all' ? 'No users found matching your criteria' : 'No users found'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="users-item-card"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                onClick={() => handleUserClick(user)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ 
                        margin: 0, 
                        color: 'black', 
                        fontSize: '1.1rem',
                        fontWeight: '600'
                      }}>
                        {user.firstName} {user.lastName || 'No Name'}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: '#6b7280',
                          color: 'white'
                        }}>
                          {user.type}
                        </span>
                        {user.isAdmin && (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: 'var(--primary-color)',
                            color: 'white'
                          }}>
                            Admin
                          </span>
                        )}
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: user.approved ? '#10b981' : '#f59e0b',
                          color: 'white'
                        }}>
                          {user.approved ? 'Approved' : 'Pending'}
                        </span>
                        {user.billing?.subscription_status === 'active' && user.billing?.subscription_type ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: '#8b5cf6',
                            color: 'white'
                          }}>
                            {user.billing.subscription_type}
                          </span>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: '#64748b',
                            color: 'white'
                          }}>
                            Pay per Haul
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      {user.email}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Phone: {formatPhoneNumber(user.phoneNumber) || 'No Phone'}
                      {user.receiveTextUpdates && ' (Texts Enabled)'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      {user.streetAddress ? (
                        <>
                          {user.streetAddress}<br />
                          {user.city}, {user.state} {user.zip}
                        </>
                      ) : 'No Address'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Created: {formatDate(user.createdAt)}
                    </div>
                    {user.lastLoginAt && (
                      <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                        Last Login: {formatDate(user.lastLoginAt)}
                      </div>
                    )}
                  </div>
                  <div className="users-item-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(user)
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        minHeight: '32px',
                        minWidth: '60px'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="users-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }} onClick={closeUserModal}>
          <div className="users-modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'black' }}>User Details</h2>
              <button
                onClick={closeUserModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.5rem'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>First Name:</label>
                <div style={{ color: 'var(--accent-color)' }}>{selectedUser.firstName || 'Not provided'}</div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Last Name:</label>
                <div style={{ color: 'var(--accent-color)' }}>{selectedUser.lastName || 'Not provided'}</div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Email:</label>
                <div style={{ color: 'var(--accent-color)' }}>{selectedUser.email}</div>
              </div>

              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Phone:</label>
                <div style={{ color: 'var(--accent-color)' }}>{selectedUser.phone || 'Not provided'}</div>
              </div>

              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Address:</label>
                <div style={{ color: 'var(--accent-color)' }}>{selectedUser.address || 'Not provided'}</div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Status:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    backgroundColor: selectedUser.approved ? '#10b981' : '#f59e0b',
                    color: 'white'
                  }}>
                    {selectedUser.approved ? 'Approved' : 'Pending'}
                  </span>
                  <button
                    onClick={() => toggleApproval(selectedUser)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: selectedUser.approved ? '#f59e0b' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedUser.approved ? 'Set Pending' : 'Approve'}
                  </button>
                </div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Admin Status:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    backgroundColor: selectedUser.isAdmin ? 'var(--primary-color)' : '#6b7280',
                    color: 'white'
                  }}>
                    {selectedUser.isAdmin ? 'Admin' : selectedUser.type || 'User'}
                  </span>
                  {!selectedUser.isAdmin && (
                    <button
                      onClick={() => toggleUserRole(selectedUser)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Make Admin
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Billing Plan:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedUser.billing?.subscription_status === 'active' && selectedUser.billing?.subscription_type ? (
                    <>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        backgroundColor: '#8b5cf6',
                        color: 'white'
                      }}>
                        {selectedUser.billing.subscription_type}
                      </span>
                      <span style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                        (Active Subscription)
                      </span>
                    </>
                  ) : (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      backgroundColor: '#64748b',
                      color: 'white'
                    }}>
                      Pay per Haul
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>User ID:</label>
                <div style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {selectedUser.uid || selectedUser.id}
                </div>
              </div>
              
              <div>
                <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Created:</label>
                <div style={{ color: 'var(--accent-color)' }}>{formatDate(selectedUser.createdAt)}</div>
              </div>
              
              {selectedUser.lastLoginAt && (
                <div>
                  <label style={{ fontWeight: '600', color: 'black', display: 'block', marginBottom: '0.25rem' }}>Last Login:</label>
                  <div style={{ color: 'var(--accent-color)' }}>{formatDate(selectedUser.lastLoginAt)}</div>
                </div>
              )}
            </div>
            
            <div className="users-modal-buttons" style={{ 
              display: 'flex', 
              gap: '1rem', 
              marginTop: '2rem',
              flexWrap: 'wrap'
            }}>
              {!selectedUser.isAdmin && (
                <button
                  onClick={() => toggleUserRole(selectedUser)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                    flex: '1 1 auto'
                  }}
                >
                  Grant Admin Access
                </button>
              )}
              <button
                onClick={() => {
                  closeUserModal()
                  handleDeleteClick(selectedUser)
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  flex: '1 1 auto'
                }}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '1rem'
        }} onClick={closeDeleteModal}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'black' }}>Delete User</h3>
            <p style={{ color: 'var(--accent-color)', marginBottom: '1.5rem' }}>
              Are you sure you want to delete <strong>{userToDelete.displayName || userToDelete.email}</strong>? 
              This action cannot be undone.
            </p>
            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={closeDeleteModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  flex: '1 1 auto'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  flex: '1 1 auto'
                }}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Users
