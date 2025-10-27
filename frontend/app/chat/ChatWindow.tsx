import React, { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LoginButton } from "../auth/LoginButton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface PDF {
  id: string;
  workId: string;
  workTitle: string | null;
  originalName: string;
  orcidId: string | null;
  researcherName: string | null;
  uploadedAt: Date;
  isOwner: boolean;
  relevanceScore?: number; // For AI suggestions
}

interface ChatWindowProps {
  initialMessage?: string;
}

export function ChatWindow({ initialMessage }: ChatWindowProps = { initialMessage: "" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [showPdfSelector, setShowPdfSelector] = useState(false);
  const [suggestedPdfs, setSuggestedPdfs] = useState<PDF[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProcessedInitialMessage = useRef(false);

  let auth: any;
  try {
    auth = useAuth0();
  } catch (e) {
    // Auth0 provider not available
    auth = { isAuthenticated: false, isLoading: false };
  }

  const { isAuthenticated, isLoading } = auth;

  // Fetch user's PDFs
  useEffect(() => {
    if (isAuthenticated && auth?.getAccessTokenSilently) {
      fetchPdfs();
    }
  }, [isAuthenticated]);

  const fetchPdfs = async () => {
    try {
      const token = await auth.getAccessTokenSilently();
      const response = await fetch("http://localhost:3001/api/pdf-rag/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPdfs(data);
      }
    } catch (error) {
      console.error("Failed to fetch PDFs:", error);
    }
  };

  const loadPdf = async (pdfId: string) => {
    setLoadingPdf(true);
    try {
      const token = await auth.getAccessTokenSilently();
      const response = await fetch("http://localhost:3001/api/pdf-rag/load", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pdfId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPdfId(pdfId);
        setShowPdfSelector(false);
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `PDF loaded: ${data.workTitle || "Document"}. You can now ask questions about this paper.`,
          },
        ]);
      } else {
        alert("Failed to load PDF");
      }
    } catch (error) {
      console.error("Failed to load PDF:", error);
      alert("Failed to load PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  const unloadPdf = () => {
    setSelectedPdfId(null);
    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: "PDF unloaded. I can now answer general questions again.",
      },
    ]);
  };

  const fetchPdfSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 10) {
      setSuggestedPdfs([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const token = await auth.getAccessTokenSilently();
      const response = await fetch("http://localhost:3001/api/pdf-suggestions/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedPdfs(data.suggestions || []);
      } else {
        setSuggestedPdfs([]);
      }
    } catch (error) {
      console.error("Failed to fetch PDF suggestions:", error);
      setSuggestedPdfs([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle initial message from search
  useEffect(() => {
    if (initialMessage && !hasProcessedInitialMessage.current && isAuthenticated && !isLoading) {
      hasProcessedInitialMessage.current = true;
      setInput(initialMessage);
      // Auto-submit after a short delay to allow the component to render
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 500);
    }
  }, [initialMessage, isAuthenticated, isLoading]);

  // Debounce PDF suggestions based on input
  useEffect(() => {
    if (!isAuthenticated || !input.trim() || selectedPdfId) return;

    const timeoutId = setTimeout(() => {
      fetchPdfSuggestions(input);
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [input, isAuthenticated, selectedPdfId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = input;
    setInput("");
    setIsStreaming(true);

    // Keep focus on input
    inputRef.current?.focus();

    // Add placeholder for assistant response
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    // Get last 5 user messages for context (up to the current message)
    const recentMessages = messages.slice(-9); // Last 4 exchanges (8 messages) + current user message
    const conversationHistory = [
      ...recentMessages,
      userMessage
    ].filter(msg => msg.content.trim() !== ""); // Filter out empty messages

    try {
      // Get Auth0 access token
      let token = null;
      if (auth?.getAccessTokenSilently) {
        try {
          token = await auth.getAccessTokenSilently();
        } catch (err) {
          console.warn("Failed to get access token:", err);
        }
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://localhost:3001/chat/stream", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          message: messageToSend,
          history: conversationHistory,
          pdfId: selectedPdfId, // Include selected PDF ID for RAG
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content + data.token
                  };
                }
                return updated;
              });
            }
            if (data.done) {
              setIsStreaming(false);
            }
            if (data.error) {
              console.error("Stream error:", data.error);
              setIsStreaming(false);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error streaming:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === "assistant") {
          lastMsg.content = "Error: Failed to get response from server.";
        }
        return updated;
      });
      setIsStreaming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          AI Chat
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-center max-w-md">
          Please log in to access the AI chat assistant powered by OpenAI.
        </p>
        <LoginButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Agentic Research
        </h1>
        <div className="flex items-center gap-3">
          {selectedPdfId && (
            <button
              onClick={unloadPdf}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Unload PDF
            </button>
          )}
          <button
            onClick={() => setShowPdfSelector(!showPdfSelector)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {selectedPdfId ? "Change PDF" : "Select PDF"}
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {auth?.user?.name || "User"}
          </span>
        </div>
      </header>

      {/* PDF Selector Modal */}
      {showPdfSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Select a PDF for Research
              </h2>
              <input
                type="text"
                placeholder="Search PDFs by title or researcher..."
                value={pdfSearchQuery}
                onChange={(e) => setPdfSearchQuery(e.target.value)}
                className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {pdfs.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                  No PDFs available. Upload some PDFs in My Researchers section.
                </p>
              ) : (
                <div className="space-y-3">
                  {pdfs
                    .filter((pdf) => {
                      const query = pdfSearchQuery.toLowerCase();
                      return (
                        !query ||
                        pdf.workTitle?.toLowerCase().includes(query) ||
                        pdf.originalName.toLowerCase().includes(query) ||
                        pdf.researcherName?.toLowerCase().includes(query)
                      );
                    })
                    .map((pdf) => (
                      <div
                        key={pdf.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => loadPdf(pdf.id)}
                      >
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {pdf.workTitle || pdf.originalName}
                        </h3>
                        {pdf.researcherName && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            By: {pdf.researcherName}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {pdf.isOwner ? "Your PDF" : "Shared with you"}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowPdfSelector(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingPdf && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mt-4">
          <p className="text-yellow-800 dark:text-yellow-200">Loading PDF and creating vector store...</p>
        </div>
      )}

      {selectedPdfId && (
        <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg p-3 mt-4">
          <p className="text-purple-800 dark:text-purple-200">
            📄 PDF Loaded - Ask questions about this paper
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            Send a message to start chatting with the AI assistant.
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      // Customize code blocks
                      code(props) {
                        const { node, inline, className, children, ...rest } = props as any;
                        return inline ? (
                          <code className="bg-gray-300 dark:bg-gray-600 px-1 rounded" {...rest}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...rest}>
                            {children}
                          </code>
                        );
                      },
                      // Customize links
                      a(props) {
                        const { node, children, ...rest } = props as any;
                        return (
                          <a className="text-blue-600 dark:text-blue-400 hover:underline" {...rest}>
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* AI-Powered PDF Suggestions */}
        {suggestedPdfs.length > 0 && !selectedPdfId && (
          <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                🤖 AI Suggested PDFs for your query:
              </span>
              {loadingSuggestions && (
                <span className="text-xs text-gray-500">Analyzing...</span>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggestedPdfs.map((pdf) => (
                <button
                  key={pdf.id}
                  type="button"
                  onClick={() => {
                    loadPdf(pdf.id);
                    setSuggestedPdfs([]);
                  }}
                  className="flex-shrink-0 px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                        {pdf.workTitle || pdf.originalName}
                      </p>
                      {pdf.researcherName && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {pdf.researcherName}
                        </p>
                      )}
                      {pdf.relevanceScore && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          {pdf.relevanceScore}% relevant
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Click a suggested PDF to load it and get context-aware answers
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isStreaming ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
