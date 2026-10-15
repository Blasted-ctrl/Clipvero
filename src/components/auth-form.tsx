"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { foundationApi } from "@/lib/foundation-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Film } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./app-provider";
import { Logo } from "./shell";
import { Button } from "./ui/button";
const formSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  name: z.string().trim().min(1, "Enter your name.").max(80).optional(),
});
export function AuthForm({
  signup = false,
  foundation = false,
}: {
  signup?: boolean;
  foundation?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
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
            onSubmit={handleSubmit(async (form) => {
              setBusy(true);
              setError("");
              try {
                const submit = foundation ? foundationApi : api;
                await submit(
                  signup ? "auth/register" : "auth/login",
                  "POST",
                  form,
                );
                client.clear();
                router.replace("/overview");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to sign in.");
              } finally {
                setBusy(false);
              }
            })}
          >
            {signup && (
              <label>
                Your name
                <input
                  {...register("name")}
                  aria-invalid={!!errors.name}
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
                {...register("email")}
                aria-invalid={!!errors.email}
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                {...register("password")}
                aria-invalid={!!errors.password}
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
                placeholder="At least 12 characters"
              />
            </label>
            {Object.values(errors).map((field, index) => (
              <p className="inline-error" role="alert" key={index}>
                {field.message}
              </p>
            ))}
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
