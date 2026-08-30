export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'CUSTOMER' | 'ADMIN'
}
