"use client";

import { useState, useEffect } from "react";

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error || new Error(event.message));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(event.reason || new Error("Unhandled promise rejection"));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  if (hasError && error) {
    return (
      <div className="mc-error" role="alert">
        <h3>⚠️ Something went wrong</h3>
        <p>{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mc-btn"
          style={{ marginTop: 12 }}
        >
          Reload page
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
