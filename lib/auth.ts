import { type NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
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
    CredentialsProvider({
      id: 'dev',
      name: 'Dev Login',
      credentials: {},
      async authorize() {
        if (process.env.NODE_ENV !== 'development') return null
        const DEV_EMAIL = 'dev@local.dev'
        await db.insert(users).values({ email: DEV_EMAIL, name: 'Dev User' }).onConflictDoNothing()
        const [user] = await db.select().from(users).where(eq(users.email, DEV_EMAIL))
        if (!user) return null
        await seedDefaultCategories(user.id)
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'dev') return true
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
