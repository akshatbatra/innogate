import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex items-center gap-3">
      {user?.picture && (
        <img src={user.picture as string} alt={user.name as string} className="w-8 h-8 rounded-full" />
      )}
      <div className="text-sm">
        <div className="font-medium">{user?.name}</div>
        <div className="text-xs text-gray-500">{user?.email}</div>
      </div>
    </div>
  );
}
