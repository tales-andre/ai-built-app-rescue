"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { name: string | null; email: string } | null;

// Shows who the server says is logged in. Asked again on every page change.
export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => live && setMe(d.user ?? null))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("user");
    setMe(null);
    router.push("/login");
  }

  if (me === undefined) return null;
  if (!me) return <Link href="/login">Log in</Link>;
  return (
    <>
      <span className="who" data-testid="who">Logged in as <strong>{me.name || me.email}</strong></span>
      <button className="link" onClick={logout}>Log out</button>
    </>
  );
}
