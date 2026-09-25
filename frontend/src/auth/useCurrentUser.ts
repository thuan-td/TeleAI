import { useEffect, useState } from "react";
import { ApiError, fetchMe, type CurrentUser } from "../api/client";

interface UseCurrentUserResult {
  user: CurrentUser | null;
  isLoading: boolean;
}

/** Fetches the logged-in user once on mount. `apiFetch` (used by fetchMe)
 * already redirects to /login on a 401, so a null user here after loading
 * only happens in the brief window before that redirect takes effect. */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error(err);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading };
}
