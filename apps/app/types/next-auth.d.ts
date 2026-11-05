import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isStaff: boolean;
      /** UI hint only; authorisation re-reads the role from the DB. */
      staffRole?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isStaff?: boolean;
    staffRole?: string;
  }
}
