"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Sign-up failed");
    localStorage.setItem("user", JSON.stringify(data.user));
    router.push("/bookings");
  }

  return (
    <>
      <h1>Create an account</h1>
      <form className="stack card" onSubmit={onSubmit}>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign up</button>
      </form>
    </>
  );
}
