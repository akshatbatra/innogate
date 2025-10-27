import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export function LogoutButton() {
  let auth: any;
  try {
    auth = useAuth0();
  } catch (e) {
    return null;
  }

  const { logout } = auth;

  return (
    <button
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
    >
      Log out
    </button>
  );
}
