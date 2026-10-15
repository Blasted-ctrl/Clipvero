"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-form-wrap" role="alert">
        <h1>Your studio could not load.</h1>
        <p>
          The workspace service may be unavailable. Your saved work is retained.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
