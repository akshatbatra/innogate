import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import type { Route } from "./+types/discover";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Discover Researchers - Innogate" },
    { name: "description", content: "Search and discover researchers by ORCID" },
  ];
}

interface Work {
  id: string;
  title: string;
  doi: string | null;
  publication_year: number | null;
  cited_by_count: number;
  primary_location?: {
    landing_page_url: string | null;
  };
}

export default function Discover() {
  const { isAuthenticated, isLoading, loginWithRedirect, user, getAccessTokenSilently } = useAuth0();
  const [orcidId, setOrcidId] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researcherName, setResearcherName] = useState<string>("");
  const [linkingOrcid, setLinkingOrcid] = useState<string | null>(null);

  const searchWorks = async () => {
    if (!orcidId.trim()) {
      setError("Please enter an ORCID ID");
      return;
    }

    setLoading(true);
    setError(null);
    setWorks([]);
    setResearcherName("");

    try {
      const response = await fetch(
        `https://api.openalex.org/works?filter=author.orcid:${orcidId}&per-page=50&sort=cited_by_count:desc`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch works from OpenAlex");
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setWorks(data.results);
        
        // Try to get researcher name from the first work's authorship
        const firstWork = data.results[0];
        const author = firstWork.authorships?.find(
          (a: any) => a.author?.orcid === `https://orcid.org/${orcidId}`
        );
        if (author?.author?.display_name) {
          setResearcherName(author.author.display_name);
        }
      } else {
        setError("No works found for this ORCID ID");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const linkResearcher = async (orcid: string, name: string) => {
    if (!isAuthenticated || !user?.email) {
      loginWithRedirect();
      return;
    }

    setLinkingOrcid(orcid);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("http://localhost:3001/api/researchers/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orcidId: orcid,
          researcherName: name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to link researcher");
      }

      alert("Researcher linked successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to link researcher");
    } finally {
      setLinkingOrcid(null);
    }
  };

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
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                AgentIc Research
              </a>
              <a
                href="/discover"
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Discover Researchers
          </h1>
          <p className="text-gray-600">
            Enter an ORCID ID to browse a researcher's published works
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={orcidId}
              onChange={(e) => setOrcidId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchWorks()}
              placeholder="Enter ORCID ID (e.g., 0000-0001-2345-6789)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={searchWorks}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          {error && (
            <div className="mt-4 text-red-600 text-sm">{error}</div>
          )}
        </div>

        {researcherName && (
          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {researcherName}
                </h2>
                <p className="text-sm text-gray-600">ORCID: {orcidId}</p>
              </div>
              <button
                onClick={() => linkResearcher(orcidId, researcherName)}
                disabled={linkingOrcid === orcidId}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {linkingOrcid === orcidId ? "Linking..." : "Link Researcher"}
              </button>
            </div>
          </div>
        )}

        {works.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Published Works ({works.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {works.map((work) => (
                <div key={work.id} className="p-6 hover:bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {work.title}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {work.publication_year && (
                      <span>Year: {work.publication_year}</span>
                    )}
                    <span>Citations: {work.cited_by_count}</span>
                    {work.doi && (
                      <a
                        href={`https://doi.org/${work.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        DOI: {work.doi}
                      </a>
                    )}
                    {work.primary_location?.landing_page_url && (
                      <a
                        href={work.primary_location.landing_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Publication →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
