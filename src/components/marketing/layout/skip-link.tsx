"use client";

/** Moves focus to the main landmark without adding `#main` to the URL. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(event) => {
        const main = document.getElementById("main");
        if (!main) return;
        event.preventDefault();
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: "start" });
      }}
    >
      Skip to content
    </a>
  );
}
