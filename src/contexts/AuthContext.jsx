import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { markPasswordRecoveryPending } from '@/lib/authRecovery'

const AuthContext = createContext(null)

function redirectToPasswordReset() {
  if (window.location.pathname === '/reset-password') return
  window.location.replace(`/reset-password${window.location.hash || ''}`)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    return data
  }

  // Force a fresh JWT (re-runs the access-token hook -> fresh tradenet_* claims)
  // and re-read the profile. Used after a purchase to pick up the new plan
  // without a re-login. Returns the refreshed profile row (or null).
  async function refreshAccess() {
    const { data: { session: s } } = await supabase.auth.refreshSession()
    setSession(s ?? null)
    setUser(s?.user ?? null)
    if (s?.user) return await fetchProfile(s.user.id)
    return null
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecoveryPending()
        redirectToPasswordReset()
      }
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password, emailRedirectTo) {
    const options = emailRedirectTo ? { emailRedirectTo } : undefined
    const { data, error } = await supabase.auth.signUp({ email, password, options })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function requestPasswordReset(email, redirectTo) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    if (error) throw error
    return data
  }

  async function updatePassword(password) {
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshAccess,
      refreshProfile: fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
