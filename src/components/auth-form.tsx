"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Film } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./app-provider";
import { Logo } from "./shell";
import { Button } from "./ui/button";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter(),
    client = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link href="/">
          <Logo />
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR IDEAS, IN MOTION</span>
          <h1>
            {signup
              ? "Your next chapter starts here."
              : "Welcome back to the studio."}
          </h1>
          <p className="muted">
            {signup
              ? "A little inspiration. A whole lot of possibility."
              : "Pick up where you left off. Make something worth watching."}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = new FormData(e.currentTarget);
              try {
                await api(
                  signup ? "auth/register" : "auth/login",
                  "POST",
                  Object.fromEntries(form),
                );
                client.clear();
                router.replace("/overview");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to sign in.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="Alex Morgan"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
                placeholder="At least 12 characters"
              />
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy
                ? "Opening your studio…"
                : signup
                  ? "Create your account"
                  : "Sign in"}
              <ArrowRight size={16} />
            </Button>
            {signup && (
              <small className="muted">
                Includes 120 one-time trial credits. No card required. Upload
                only content you own or have permission to use.
              </small>
            )}
          </form>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to Clipvero?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
        <small className="muted">
          Clipvero · A little less work. A lot more creating.
        </small>
      </div>
      <div className="auth-art">
        <div className="art-film">
          <Film size={36} />
          <span>
            Every great video
            <br />
            starts with an idea.
          </span>
          <small>Make yours happen.</small>
        </div>
        <div className="auth-benefits">
          {[
            "Your scripts, your creative control",
            "One editor from idea to export",
            "A workflow that grows with you",
          ].map((t) => (
            <span key={t}>
              <Check size={15} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
