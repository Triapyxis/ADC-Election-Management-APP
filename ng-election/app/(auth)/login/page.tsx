
"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";

function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const next = useSearchParams().get("next") ?? "/account";

  return (
    <form action={action} className="max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <p className="text-sm text-ink-soft">
        For field agents, supervisors, verifiers and administrators.
        Results are public without signing in.
      </p>

      <input type="hidden" name="next" value={next} />

      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2"
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-status-disputed">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-green px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="max-w-sm space-y-4 p-4">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-ink-soft">Loading login...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
