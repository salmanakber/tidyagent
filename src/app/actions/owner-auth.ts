"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { signInUser } from "@/modules/auth/workspace";
import { clearSessionCookie } from "@/lib/security/session";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function signUpWithEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || password.length < 8) {
    redirect("/signup?error=invalid");
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    redirect("/login?error=exists");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || email.split("@")[0],
      passwordHash: await hashPassword(password),
    },
  });

  await signInUser(user);
  redirect("/onboarding");
}

export async function loginWithEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  await signInUser(user);
  redirect("/dashboard");
}

export async function logoutOwner() {
  await clearSessionCookie();
  redirect("/login");
}
