export const BETA_CHECKOUT_VISIBLE =
  import.meta.env.VITE_BETA_CHECKOUT_VISIBLE === 'true'

export const PRIMARY_LAUNCH_PATH = BETA_CHECKOUT_VISIBLE
  ? '/pricing'
  : '/terminal'

export const PRIMARY_LAUNCH_LABEL = BETA_CHECKOUT_VISIBLE
  ? 'View Beta Pricing'
  : 'Join Waitlist'
