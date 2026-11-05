"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { isStaffRole, type StaffRole } from "@/lib/permissions";
import { requirePermission } from "@/lib/server/guard";
import { audit } from "@/lib/server/audit";

export type StaffUserRow = {
  id: string;
  name: string | null;
  email: string;
  staffRole: string;
  hasPassword: boolean;
  createdAt: Date;
};

const MIN_PASSWORD_LENGTH = 12;

async function hash(password: string): Promise<string> {
  const bcryptMod = await import("bcryptjs");
  const bcrypt = bcryptMod.default ?? bcryptMod;
  return bcrypt.hash(password, 12);
}

export async function listStaffUsers(): Promise<StaffUserRow[]> {
  await requirePermission("user:read", { entity: "User" });
  const users = await prisma.user.findMany({
    where: { isStaff: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      staffRole: true,
      passwordHash: true,
      createdAt: true,
    },
  });
  return users.map(({ passwordHash, ...u }) => ({
    ...u,
    hasPassword: Boolean(passwordHash),
  }));
}

export async function createStaffUser(input: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<{ id: string }> {
  const admin = await requirePermission("user:create", { entity: "User" });
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email");
  if (!isStaffRole(input.role)) throw new Error("Invalid role");
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with that email already exists");

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim() || null,
      passwordHash: await hash(input.password),
      isStaff: true,
      staffRole: input.role,
    },
    select: { id: true },
  });
  await audit({
    actor: admin,
    action: "user.created",
    entity: "User",
    entityId: user.id,
    metadata: { email, role: input.role },
  });
  revalidatePath("/dashboard/settings/team");
  return user;
}

/** Refuse to remove the last remaining admin (demote or revoke) so nobody is locked out. */
async function assertNotLastAdmin(userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { isStaff: true, staffRole: true },
  });
  if (target?.isStaff && target.staffRole === "ADMIN") {
    const admins = await prisma.user.count({
      where: { isStaff: true, staffRole: "ADMIN" },
    });
    if (admins <= 1) throw new Error("There must be at least one admin");
  }
}

export async function updateStaffRole(userId: string, role: StaffRole) {
  const admin = await requirePermission("user:update", { entity: "User", entityId: userId });
  if (!isStaffRole(role)) throw new Error("Invalid role");
  if (role !== "ADMIN") await assertNotLastAdmin(userId);
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffRole: true, email: true },
  });
  await prisma.user.update({ where: { id: userId }, data: { staffRole: role } });
  await audit({
    actor: admin,
    action: "user.role_changed",
    entity: "User",
    entityId: userId,
    metadata: { email: before?.email, from: before?.staffRole, to: role },
  });
  revalidatePath("/dashboard/settings/team");
}

export async function resetStaffPassword(userId: string, password: string) {
  const admin = await requirePermission("user:update", { entity: "User", entityId: userId });
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(password) },
  });
  await audit({ actor: admin, action: "user.password_reset", entity: "User", entityId: userId });
}

/** Revokes staff access (keeps the user row so history/audit stays intact). */
export async function revokeStaffAccess(userId: string) {
  const admin = await requirePermission("user:delete", { entity: "User", entityId: userId });
  if (userId === admin.id) throw new Error("You can't revoke your own access");
  await assertNotLastAdmin(userId);
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { isStaff: false, passwordHash: null },
  });
  await audit({
    actor: admin,
    action: "user.access_revoked",
    entity: "User",
    entityId: userId,
    metadata: { email: before?.email },
  });
  revalidatePath("/dashboard/settings/team");
}
