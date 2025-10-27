import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export function LoginButton() {
  // If the Auth0Provider is not present (or package missing), useAuth0 will
  // throw. Catch that so the UI fails gracefully without breaking the whole app.
  let auth: any;
  try {
    auth = useAuth0();
  } catch (e) {
    // Provider missing or other hook error — render nothing so the page still works.
    return null;
  }

  const { loginWithRedirect, isLoading } = auth;

  return (
    <button
      onClick={() => loginWithRedirect()}
      disabled={isLoading}
      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
    >
      Log in / Sign up
    </button>
  );
}
