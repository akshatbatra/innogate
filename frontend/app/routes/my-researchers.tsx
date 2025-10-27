import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import type { Route } from "./+types/my-researchers";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Researchers - Innogate" },
    { name: "description", content: "View your linked researchers" },
  ];
}

interface LinkedResearcher {
  id: string;
  orcidId: string;
  researcherName: string;
  createdAt: string;
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

interface PdfInfo {
  id: string;
  originalName: string;
  uploadedAt: Date;
  isOwner: boolean;
}

interface ShareRequest {
  id: string;
  pdfId: string;
  workId: string;
  workTitle: string | null;
  orcidId: string | null;
  researcherName: string | null;
  originalName: string;
  fromUserEmail: string;
  createdAt: string;
}

export default function MyResearchers() {
  const { isAuthenticated, isLoading, loginWithRedirect, user, getAccessTokenSilently } = useAuth0();
  const [researchers, setResearchers] = useState<LinkedResearcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrcid, setSelectedOrcid] = useState<string | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<Record<string, PdfInfo>>({});
  const [uploadingWorkId, setUploadingWorkId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetPdfId, setShareTargetPdfId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharingPdf, setSharingPdf] = useState(false);
  const [shareRequests, setShareRequests] = useState<ShareRequest[]>([]);
  const [showShareRequests, setShowShareRequests] = useState(false);
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      fetchResearchers();
      fetchShareRequests();
    } else if (!isLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, user?.email, isLoading]);

  const fetchResearchers = async () => {
    if (!user?.email) return;

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/researchers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch researchers");
      }

      const data = await response.json();
      setResearchers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchShareRequests = async () => {
    if (!user?.email) return;

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/pdfs/share-requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShareRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch share requests:", err);
    }
  };

  const handleSharePdf = (pdfId: string) => {
    setShareTargetPdfId(pdfId);
    setShareEmail("");
    setShareModalOpen(true);
  };

  const submitShareRequest = async () => {
    if (!shareTargetPdfId || !shareEmail.trim()) return;

    setSharingPdf(true);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/pdfs/${shareTargetPdfId}/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetEmail: shareEmail.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to share PDF");
      }

      alert("Share request sent successfully!");
      setShareModalOpen(false);
      setShareEmail("");
      setShareTargetPdfId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to share PDF");
    } finally {
      setSharingPdf(false);
    }
  };

  const handleAcceptShare = async (requestId: string) => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/pdfs/share-requests/${requestId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to accept share request");
      }

      alert("Share request accepted!");
      fetchShareRequests();
      // Refresh PDF status if viewing works
      if (selectedOrcid) {
        viewWorks(selectedOrcid);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to accept share request");
    }
  };

  const handleRejectShare = async (requestId: string) => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/pdfs/share-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reject share request");
      }

      alert("Share request rejected");
      fetchShareRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject share request");
    }
  };

  const viewWorks = async (orcidId: string) => {
    setSelectedOrcid(orcidId);
    setLoadingWorks(true);
    setWorks([]);
    setPdfStatus({});

    try {
      const response = await fetch(
        `https://api.openalex.org/works?filter=author.orcid:${orcidId}&per-page=50&sort=cited_by_count:desc`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch works from OpenAlex");
      }

      const data = await response.json();
      const fetchedWorks = data.results || [];
      setWorks(fetchedWorks);

      // Fetch PDF status for all works
      if (fetchedWorks.length > 0 && user?.email) {
        const token = await getAccessTokenSilently();
        const workIds = fetchedWorks.map((w: Work) => w.id).join(",");
        const pdfResponse = await fetch(
          `http://localhost:3001/api/pdfs?workIds=${workIds}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          setPdfStatus(pdfData);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load works");
    } finally {
      setLoadingWorks(false);
    }
  };

  const unlinkResearcher = async (id: string) => {
    if (!confirm("Are you sure you want to unlink this researcher?")) {
      return;
    }

    setDeletingId(id);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/researchers/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to unlink researcher");
      }

      setResearchers(researchers.filter((r) => r.id !== id));
      if (selectedOrcid === researchers.find((r) => r.id === id)?.orcidId) {
        setSelectedOrcid(null);
        setWorks([]);
        setPdfStatus({});
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unlink researcher");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFileUpload = async (
    workId: string,
    file: File,
    workTitle: string,
    orcidId: string,
    researcherName: string
  ) => {
    if (!user?.email) return;

    setUploadingWorkId(workId);

    try {
      const token = await getAccessTokenSilently();
      const formData = new FormData();
      formData.append("file", file);

      const params = new URLSearchParams({
        workId,
        workTitle,
        orcidId,
        researcherName,
      });

      const response = await fetch(
        `http://localhost:3001/api/pdfs/upload?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload PDF");
      }

      const data = await response.json();
      
      // Update PDF status
      setPdfStatus({
        ...pdfStatus,
        [workId]: {
          id: data.id,
          originalName: data.originalName,
          uploadedAt: data.uploadedAt,
          isOwner: true,
        },
      });

      alert("PDF uploaded successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload PDF");
    } finally {
      setUploadingWorkId(null);
    }
  };

  const handleViewPdf = async (workId: string) => {
    if (!user?.email) return;

    const pdfInfo = pdfStatus[workId];
    if (!pdfInfo) return;

    try {
      const token = await getAccessTokenSilently();
      const url = `http://localhost:3001/api/pdfs/${pdfInfo.id}`;
      
      // Fetch with auth and open in new tab
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch PDF");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err) {
      alert("Failed to open PDF");
    }
  };

  const handleDeletePdf = async (workId: string, pdfId: string) => {
    if (!confirm("Are you sure you want to delete this PDF?")) {
      return;
    }

    setDeletingPdfId(pdfId);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `http://localhost:3001/api/pdfs/${pdfId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete PDF");
      }

      // Remove PDF from status
      const newPdfStatus = { ...pdfStatus };
      delete newPdfStatus[workId];
      setPdfStatus(newPdfStatus);

      alert("PDF deleted successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete PDF");
    } finally {
      setDeletingPdfId(null);
    }
  };

  const triggerFileUpload = (workId: string, workTitle: string, orcidId: string, researcherName: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(workId, file, workTitle, orcidId, researcherName);
      }
    };
    input.click();
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please log in to view your linked researchers.
          </p>
          <button
            onClick={() => loginWithRedirect()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
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
                className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Discover
              </a>
              <a
                href="/my-researchers"
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
              >
                My Researchers
              </a>
            </div>
            <div className="flex items-center gap-4">
              {shareRequests.length > 0 && (
                <button
                  onClick={() => setShowShareRequests(!showShareRequests)}
                  className="relative bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Share Requests
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {shareRequests.length}
                  </span>
                </button>
              )}
              <span className="text-sm text-gray-600">{user?.email}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Share Requests Modal */}
      {showShareRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Share Requests ({shareRequests.length})
              </h2>
              <button
                onClick={() => setShowShareRequests(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {shareRequests.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No pending share requests
                </p>
              ) : (
                <div className="space-y-4">
                  {shareRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <h3 className="font-medium text-gray-900 mb-2">
                        {request.workTitle || request.originalName}
                      </h3>
                      {request.researcherName && (
                        <p className="text-sm text-gray-700 mb-1">
                          Researcher: <span className="font-medium">{request.researcherName}</span>
                        </p>
                      )}
                      {request.orcidId && (
                        <p className="text-sm text-gray-600 mb-2">
                          ORCID: {request.orcidId}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        PDF: {request.originalName}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        From: <span className="font-medium">{request.fromUserEmail}</span>
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        Requested: {new Date(request.createdAt).toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptShare(request.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectShare(request.id)}
                          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share PDF Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Share PDF</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient's Email
              </label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && submitShareRequest()}
              />
              <p className="text-xs text-gray-500 mt-2">
                The user will receive a share request and can accept or reject it.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShareModalOpen(false);
                  setShareEmail("");
                  setShareTargetPdfId(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={sharingPdf}
              >
                Cancel
              </button>
              <button
                onClick={submitShareRequest}
                disabled={!shareEmail.trim() || sharingPdf}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sharingPdf ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            My Linked Researchers
          </h1>
          <p className="text-gray-600">
            View and manage researchers you've linked to your account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {researchers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">
              You haven't linked any researchers yet.
            </p>
            <a
              href="/discover"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700"
            >
              Discover Researchers
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Linked Researchers ({researchers.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {researchers.map((researcher) => (
                  <div
                    key={researcher.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      selectedOrcid === researcher.orcidId ? "bg-blue-50" : ""
                    }`}
                    onClick={() => viewWorks(researcher.orcidId)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {researcher.researcherName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          ORCID: {researcher.orcidId}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Linked: {new Date(researcher.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unlinkResearcher(researcher.id);
                        }}
                        disabled={deletingId === researcher.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:text-gray-400"
                      >
                        {deletingId === researcher.id ? "Removing..." : "Unlink"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Works
                </h2>
              </div>
              {!selectedOrcid ? (
                <div className="p-8 text-center text-gray-600">
                  Select a researcher to view their works
                </div>
              ) : loadingWorks ? (
                <div className="p-8 text-center text-gray-600">
                  Loading works...
                </div>
              ) : works.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  No works found for this researcher
                </div>
              ) : (
                <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                  {works.map((work) => {
                    const hasPdf = pdfStatus[work.id];
                    const isUploading = uploadingWorkId === work.id;
                    const currentResearcher = researchers.find(r => r.orcidId === selectedOrcid);

                    return (
                      <div key={work.id} className="p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                          {work.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
                          {work.publication_year && (
                            <span>Year: {work.publication_year}</span>
                          )}
                          <span>Citations: {work.cited_by_count}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          {work.doi && (
                            <a
                              href={`https://doi.org/${work.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              DOI →
                            </a>
                          )}
                          {work.primary_location?.landing_page_url && (
                            <a
                              href={work.primary_location.landing_page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              View Publication →
                            </a>
                          )}
                          
                          {/* PDF Actions */}
                          <div className="ml-auto flex gap-2">
                            {hasPdf ? (
                              <>
                                <button
                                  onClick={() => handleViewPdf(work.id)}
                                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                  View PDF
                                </button>
                                {hasPdf.isOwner ? (
                                  <>
                                    <button
                                      onClick={() => currentResearcher && triggerFileUpload(work.id, work.title, currentResearcher.orcidId, currentResearcher.researcherName)}
                                      disabled={isUploading}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400"
                                    >
                                      {isUploading ? "Updating..." : "Update PDF"}
                                    </button>
                                    <button
                                      onClick={() => handleSharePdf(hasPdf.id)}
                                      className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                                    >
                                      Share
                                    </button>
                                    <button
                                      onClick={() => handleDeletePdf(work.id, hasPdf.id)}
                                      disabled={deletingPdfId === hasPdf.id}
                                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-gray-400"
                                    >
                                      {deletingPdfId === hasPdf.id ? "Deleting..." : "Delete"}
                                    </button>
                                  </>
                                ) : (
                                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                    Shared with you
                                  </span>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => currentResearcher && triggerFileUpload(work.id, work.title, currentResearcher.orcidId, currentResearcher.researcherName)}
                                disabled={isUploading}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400"
                              >
                                {isUploading ? "Uploading..." : "Upload PDF"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
