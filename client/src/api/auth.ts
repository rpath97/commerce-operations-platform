import axios from 'axios'
import { api } from './apiClient.ts'
import type { AuthUser } from '../types/auth.ts'

type MeResponse = {
  user: AuthUser
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<AuthUser | null> {
  try {
    const response = await api.get<MeResponse>('/auth/me', { signal })
    return response.data.user
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null
    }
    throw error
  }
}
