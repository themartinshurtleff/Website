import { supabase } from '@/lib/supabase'

async function invokeRelease(action) {
  const { data, error } = await supabase.functions.invoke('terminal-download', {
    body: { action },
  })

  if (error) {
    try {
      const payload = await error.context?.json()
      if (payload?.error) throw new Error(payload.error)
    } catch (contextError) {
      if (
        contextError instanceof Error &&
        contextError.message !== 'Unexpected end of JSON input'
      ) {
        throw contextError
      }
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function getCurrentTerminalRelease() {
  return await invokeRelease('status')
}

export async function createTerminalDownload() {
  return await invokeRelease('download')
}
