import axios from 'axios'
import { api } from './apiClient.ts'
import type { AuthUser } from '../types/auth.ts'

type MeResponse = {
  user: AuthUser
}

type AuthResponse = {
  user: AuthUser
}

export type RegisterInput = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export type LoginInput = {
  email: string
  password: string
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

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  const response = await api.post<AuthResponse>('/auth/login', input)
  return response.data.user
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const response = await api.post<AuthResponse>('/auth/register', input)
  return response.data.user
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout')
}
