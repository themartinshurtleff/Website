import { supabase } from '@/lib/supabase'

export async function recordLifecycleMilestone(event, source, properties = {}) {
  const { data, error } = await supabase.functions.invoke('lifecycle-event', {
    body: { event, source, properties },
  })
  if (error || data?.error) throw new Error(data?.error || 'lifecycle_event_failed')
  return data
}

