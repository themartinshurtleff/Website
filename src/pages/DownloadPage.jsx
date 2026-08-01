import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  Monitor,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createTerminalDownload, getCurrentTerminalRelease } from '@/lib/releases'

const desktopTiers = new Set(['referral_verified', 'beta', 'pro', 'admin'])

function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes))) return ''
  return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`
}

export default function DownloadPage() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [release, setRelease] = useState(null)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const hasDesktopAccess = desktopTiers.has(profile?.access_tier)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login?return=%2Fdownload', { replace: true })
    }
  }, [loading, navigate, user])

  useEffect(() => {
    if (!user || !profile || !hasDesktopAccess) return
    let cancelled = false
    setReleaseLoading(true)
    getCurrentTerminalRelease()
      .then((data) => {
        if (!cancelled) setRelease(data?.release || null)
      })
      .catch((requestError) => {
        console.error('release status failed', requestError)
        if (!cancelled) setError('The desktop release is temporarily unavailable.')
      })
      .finally(() => {
        if (!cancelled) setReleaseLoading(false)
      })
    return () => { cancelled = true }
  }, [hasDesktopAccess, profile, user])

  async function handleDownload() {
    setError('')
    setDownloading(true)
    try {
      const data = await createTerminalDownload()
      if (!data?.url) throw new Error('missing_download_url')
      window.location.assign(data.url)
    } catch (requestError) {
      console.error('terminal download failed', requestError)
      setError('The download could not be started. Refresh your access and try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading || !user || (user && !profile)) {
    return (
      <main className="min-h-screen bg-black pt-24 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[#c9a84c]" aria-label="Loading" />
      </main>
    )
  }

  if (!hasDesktopAccess) {
    return (
      <main className="min-h-screen bg-black pt-24">
        <div className="section-container py-20 max-w-3xl">
          <div className="border border-white/[0.08] bg-[#070707] p-8 md:p-10 rounded-lg">
            <p className="text-xs font-bold uppercase text-[#c9a84c]">Member download</p>
            <h1 className="mt-4 text-3xl md:text-4xl font-black text-[#FAFAFA]">Desktop access is not active.</h1>
            <p className="mt-4 max-w-xl text-[#A1A1AA] leading-relaxed">
              The desktop terminal is available to active beta, referral, Pro, and admin members. Your account is signed in, but it does not currently include a desktop license.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/account" className="btn-outline px-5 py-3 rounded-md text-sm">View account</Link>
              <Link to="/pricing" className="btn-gold px-5 py-3 rounded-md text-sm">View beta pricing</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black pt-24">
      <section className="section-container py-14 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-5xl mx-auto"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-white/[0.08] pb-9">
            <div>
              <p className="text-xs font-bold uppercase text-[#c9a84c]">TradeNet Desktop Beta</p>
              <h1 className="mt-3 text-4xl md:text-5xl font-black text-[#FAFAFA]">Download the terminal.</h1>
              <p className="mt-4 max-w-2xl text-[#A1A1AA] leading-relaxed">
                Install the signed Windows build, then sign in with this TradeNet account. Your plan and terminal access are checked by the server after login.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#7dd3a7]">
              <CheckCircle2 size={16} /> Access active
            </div>
          </div>

          <div className="mt-9 grid lg:grid-cols-[1.5fr_0.8fr] gap-5">
            <div className="border border-white/[0.09] bg-[#070707] rounded-lg p-7 md:p-8">
              <div className="flex items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-[#c9a84c]/25 bg-[#c9a84c]/[0.07] rounded-md flex items-center justify-center">
                    <Monitor size={22} className="text-[#c9a84c]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#FAFAFA]">Windows 10 / 11</h2>
                    <p className="mt-1 text-sm text-[#71717A]">64-bit installer</p>
                  </div>
                </div>
                {release?.version && (
                  <span className="text-xs text-[#A1A1AA] border border-white/[0.1] rounded px-2.5 py-1.5">
                    v{release.version}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || releaseLoading || !release}
                className="btn-gold mt-8 w-full md:w-auto min-w-[220px] px-6 py-3.5 rounded-md text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
              >
                {downloading || releaseLoading
                  ? <Loader2 size={17} className="animate-spin" />
                  : <Download size={17} />}
                {downloading ? 'Preparing download...' : 'Download for Windows'}
              </button>

              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

              {release && (
                <div className="mt-7 pt-6 border-t border-white/[0.07] grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#52525B]">File size</p>
                    <p className="mt-1 text-[#D4D4D8]">{formatBytes(release.size_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-[#52525B]">Channel</p>
                    <p className="mt-1 text-[#D4D4D8] capitalize">{release.channel}</p>
                  </div>
                </div>
              )}
            </div>

            <aside className="border border-white/[0.08] rounded-lg divide-y divide-white/[0.07]">
              <div className="p-6 flex gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#42d9d0]" />
                <div>
                  <h3 className="text-sm font-bold text-[#FAFAFA]">Signed Windows build</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#71717A]">The installer is code-signed and timestamped. Windows should identify Martin Shurtleff as the verified publisher.</p>
                </div>
              </div>
              <div className="p-6 flex gap-3">
                <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[#c9a84c]" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#FAFAFA]">SHA-256</h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#71717A] font-mono break-all">
                    {release?.sha256 || 'Loading release checksum...'}
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <p className="mt-6 text-xs text-[#52525B]">
            Beta software can change quickly. Keep the built-in updater enabled and report install issues through the support contact in your account.
          </p>
        </motion.div>
      </section>
    </main>
  )
}
