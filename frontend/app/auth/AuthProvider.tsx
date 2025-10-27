import React, { useEffect, useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";

type Props = { children: React.ReactNode };

// Component to initialize user in database after authentication
function UserInitializer({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initializeUser() {
      if (isAuthenticated && !initialized) {
        try {
          const token = await getAccessTokenSilently();
          const response = await fetch("http://localhost:3001/api/auth/init", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(data.isNewUser ? "✅ New user created in database" : "✅ Existing user logged in");
          } else {
            console.error("Failed to initialize user:", await response.text());
          }
        } catch (error) {
          console.error("Error initializing user:", error);
        } finally {
          setInitialized(true);
        }
      }
    }

    initializeUser();
  }, [isAuthenticated, initialized, getAccessTokenSilently]);

  return <>{children}</>;
}

// AuthProvider which only initializes Auth0Provider on the client.
// This avoids SSR issues (window is not defined on the server).
// It also enables token persistence so a page refresh doesn't immediately
// log the user out. Note: persisting tokens to localStorage has security
// implications — for production prefer Refresh Token Rotation (enable in
// the Auth0 dashboard) and set `useRefreshTokens: true`.
export default function AuthProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render children directly during SSR (no auth on server render)
    return <>{children}</>;
  }

  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

  if (!domain || !clientId) {
    // If env vars are missing, render children and show console warning.
    console.warn("VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID is not set.");
    return <>{children}</>;
  }

  // Two options to avoid being logged out on refresh:
  // 1) Persist tokens to localStorage: pass cacheLocation="localstorage".
  //    This is the simplest fix but less secure than refresh tokens.
  // 2) Use Refresh Token Rotation: set useRefreshTokens=true and enable
  //    Refresh Token Rotation for the client in the Auth0 dashboard.
  // The code below enables both cacheLocation and useRefreshTokens. If you
  // enable refresh tokens in Auth0, the SDK will keep the session across
  // reloads without storing long-lived tokens in memory.
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ 
        redirect_uri: window.location.origin,
        audience: audience, // Request access token for the API
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <UserInitializer>{children}</UserInitializer>
    </Auth0Provider>
  );
}
