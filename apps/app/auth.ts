import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/dashboard/staff-login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const { prisma } = await import("@stky/db");
        const bcryptMod = await import("bcryptjs");
        const bcrypt = bcryptMod.default ?? bcryptMod;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.isStaff) return null;
        const ok = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash
        );
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          isStaff: user.isStaff,
          staffRole: user.staffRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isStaff = (user as { isStaff?: boolean }).isStaff;
        token.staffRole = (user as { staffRole?: string }).staffRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.isStaff = Boolean(token.isStaff);
        session.user.staffRole = token.staffRole;
      }
      return session;
    },
  },
});
