import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()

export const AUTH_CAPTCHA_ENABLED = Boolean(siteKey)

const AuthCaptcha = forwardRef(function AuthCaptcha(
  { action, onTokenChange, onError },
  ref,
) {
  const widgetRef = useRef(null)

  useImperativeHandle(ref, () => ({
    reset() {
      widgetRef.current?.reset()
      onTokenChange('')
    },
  }), [onTokenChange])

  if (!AUTH_CAPTCHA_ENABLED) return null

  return (
    <div className="w-full overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.02] p-1">
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        onSuccess={onTokenChange}
        onExpire={() => onTokenChange('')}
        onError={() => {
          onTokenChange('')
          onError?.()
        }}
        options={{
          action,
          appearance: 'always',
          size: 'flexible',
          theme: 'dark',
        }}
      />
    </div>
  )
})

export default AuthCaptcha
