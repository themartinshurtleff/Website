import { supabase } from '@/lib/supabase'
import { WEB_TERMINAL_URL } from '@/lib/launchConfig'
import { recordLifecycleMilestone } from '@/lib/lifecycle'

const PROTOCOL_VERSION = 1
const HANDOFF_PARAM = 'tn_handoff'
const ORIGIN_PARAM = 'tn_origin'
const READY_MESSAGE = 'tradenet:web-terminal-ready'
const START_MESSAGE = 'tradenet:web-terminal-start'
const SESSION_MESSAGE = 'tradenet:web-terminal-session'
const ACCEPTED_MESSAGE = 'tradenet:web-terminal-accepted'
const REJECTED_MESSAGE = 'tradenet:web-terminal-rejected'
const CANCELLED_MESSAGE = 'tradenet:web-terminal-cancelled'
const HANDOFF_TIMEOUT_MS = 35_000

let launchInFlight = null

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function handoffUrl(nonce) {
  const url = new URL(WEB_TERMINAL_URL, window.location.href)
  url.hash = new URLSearchParams({
    [HANDOFF_PARAM]: nonce,
    [ORIGIN_PARAM]: window.location.origin,
  }).toString()
  return url
}

async function issueOneTimeSession() {
  const { data, error } = await supabase.functions.invoke('web-terminal-session', {
    body: {},
  })
  if (error) throw new Error('terminal_session_issue_failed')
  if (
    typeof data?.token_hash !== 'string' ||
    data.token_hash.length < 20 ||
    data.token_hash.length > 2048 ||
    data.verification_type !== 'magiclink'
  ) {
    throw new Error('terminal_session_response_invalid')
  }
  return data
}

async function openTerminalWithHandoff() {
  const nonce = randomNonce()
  const url = handoffUrl(nonce)
  const terminalOrigin = url.origin

  // This tab intentionally keeps its opener only for the short, origin-bound
  // postMessage handshake. The terminal severs the link after accepting it.
  const terminalWindow = window.open(url.toString(), `tradenet_terminal_${nonce}`)
  if (!terminalWindow) throw new Error('terminal_popup_blocked')

  return await new Promise((resolve, reject) => {
    let ready = false
    let credential = null
    let sent = false
    let settled = false

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('message', onMessage)
    }

    const finish = (error) => {
      if (settled) return
      settled = true
      if (error && ready && !terminalWindow.closed) {
        terminalWindow.postMessage({
          type: CANCELLED_MESSAGE,
          version: PROTOCOL_VERSION,
          nonce,
        }, terminalOrigin)
      }
      if (error && !sent && !terminalWindow.closed) terminalWindow.close()
      cleanup()
      if (error) reject(error)
      else resolve()
    }

    const maybeSend = () => {
      if (!ready || !credential || sent || terminalWindow.closed) return
      sent = true
      terminalWindow.postMessage({
        type: SESSION_MESSAGE,
        version: PROTOCOL_VERSION,
        nonce,
        token_hash: credential.token_hash,
        verification_type: credential.verification_type,
      }, terminalOrigin)
    }

    const onMessage = (event) => {
      if (event.origin !== terminalOrigin || event.source !== terminalWindow) return
      const message = event.data
      if (
        !message ||
        typeof message !== 'object' ||
        message.version !== PROTOCOL_VERSION ||
        message.nonce !== nonce
      ) return

      if (message.type === READY_MESSAGE) {
        if (!ready) {
          terminalWindow.postMessage({
            type: START_MESSAGE,
            version: PROTOCOL_VERSION,
            nonce,
          }, terminalOrigin)
        }
        ready = true
        maybeSend()
      } else if (message.type === ACCEPTED_MESSAGE && sent) {
        void recordLifecycleMilestone('activated', 'web_terminal_handoff', {
          platform: 'web',
          activation_marker: 'session_accepted',
        }).catch(() => console.warn('Terminal activation milestone could not be recorded.'))
        finish()
      } else if (message.type === REJECTED_MESSAGE) {
        finish(new Error('terminal_session_rejected'))
      }
    }

    const timeoutId = window.setTimeout(() => {
      finish(new Error('terminal_session_timeout'))
    }, HANDOFF_TIMEOUT_MS)

    window.addEventListener('message', onMessage)
    issueOneTimeSession()
      .then((result) => {
        credential = result
        maybeSend()
      })
      .catch((error) => finish(error))
  })
}

export function launchWebTerminal() {
  if (launchInFlight) return launchInFlight
  launchInFlight = openTerminalWithHandoff()
    .catch((error) => {
      console.error('Secure terminal launch failed', error)
      window.alert('TradeNet could not sign you into the terminal. Please try again.')
      throw error
    })
    .finally(() => {
      launchInFlight = null
    })
  return launchInFlight
}
