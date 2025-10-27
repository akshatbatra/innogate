import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import type { Route } from "./+types/agentic-research";
import { ChatWindow } from "../chat/ChatWindow";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AgentIc Research - Innogate" },
    { name: "description", content: "AI-powered research assistant" },
  ];
}

export default function AgenticResearch() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex space-x-8">
              <a
                href="/"
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Home
              </a>
              <a
                href="/agentic-research"
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
              >
                AgentIc Research
              </a>
              <a
                href="/discover"
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Discover
              </a>
              <a
                href="/my-researchers"
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                My Researchers
              </a>
            </div>
            <div>
              {isAuthenticated && (
                <span className="text-sm text-gray-600">{user?.email}</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <ChatWindow initialMessage={initialQuery} />
    </div>
  );
}
