import api from './request'

export async function startAnalyze(params: Record<string, string | undefined>): Promise<{ success: boolean; taskId?: string; message?: string }> {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value)
  }
  const { data } = await api.post('/api/analyze/start', null, { params: searchParams })
  return data
}

export async function getAnalyzeStatus(taskId: string): Promise<{ taskId: string; status: string; content?: string }> {
  const { data } = await api.get(`/api/analyze/task/${taskId}`)
  return data
}
