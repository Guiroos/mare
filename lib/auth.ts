import { type NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db'
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema'
import { seedDefaultCategories } from '@/lib/db/seed-user'

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersTable: users as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountsTable: accounts as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionsTable: sessions as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verificationTokensTable: verificationTokens as any,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim())
      return allowed.includes(user.email ?? '')
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        ;(session.user as { id?: string }).id = token.sub
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await seedDefaultCategories(user.id)
      }
    },
  },
  pages: {
    signIn: '/login',
  },
}

export function auth() {
  return getServerSession(authOptions)
}
