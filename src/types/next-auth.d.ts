import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      username: string
      isAdmin: boolean
    }
    impersonating?: {
      originalUserId: string
      originalUsername: string
      originalIsAdmin: boolean
    }
  }

  interface User {
    id: string
    email: string
    username: string
    isAdmin: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    isAdmin: boolean
    impersonating?: {
      originalUserId: string
      originalUsername: string
      originalIsAdmin: boolean
    }
  }
}
