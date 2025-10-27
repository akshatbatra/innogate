import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Innogate - Research Discovery Platform" },
    { name: "description", content: "AI-powered research discovery platform" },
  ];
}

export default function Home() {
  const { isAuthenticated, isLoading, loginWithRedirect, user } = useAuth0();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

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
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
              >
                Home
              </a>
              <a
                href="/agentic-research"
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
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
              {isAuthenticated ? (
                <span className="text-sm text-gray-600">
                  {user?.email}
                </span>
              ) : (
                <button
                  onClick={() => loginWithRedirect()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Log In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to Innogate
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Discover and collaborate with researchers worldwide. Search by ORCID, 
            explore publications, and build your research network.
          </p>

          {/* Google-like search bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  navigate(`/agentic-research?q=${encodeURIComponent(searchQuery)}`);
                }
              }}
              className="relative"
            >
              <div className="flex items-center bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 focus-within:border-blue-500">
                <div className="pl-6 pr-3 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask anything about research..."
                  className="flex-1 py-3 px-2 text-base outline-none bg-transparent"
                />
                <button
                  type="submit"
                  className="mr-2 px-5 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              Powered by AI Agent built to answer your questions about linked research
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Discover Researchers
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Search for researchers by ORCID ID and explore their published works, 
              citations, and research impact.
            </p>
            <a
              href="/discover"
              className="inline-block bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Start Discovering
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              My Researchers
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Link researchers to your account and access their profiles anytime. 
              Build your personal research network.
            </p>
            <a
              href="/my-researchers"
              className="inline-block bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
            >
              View My Network
            </a>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="mt-8 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Started Today
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Sign in to link researchers to your account and build your research network.
              </p>
              <button
                onClick={() => loginWithRedirect()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700"
              >
                Sign In with Auth0
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
