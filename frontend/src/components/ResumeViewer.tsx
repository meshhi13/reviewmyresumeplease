import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, FileWarning, RotateCcw, Send, Briefcase, GitPullRequest, CheckCircle, Wand2, Share2, CheckSquare, Square, Star } from "lucide-react";
import { loadPdfDocument } from "../pdfjs";
import { PdfPage } from "./PdfPage";
import type { Comment, Redaction } from "../types";
import type { PdfDocument } from "../pdfjs";

type Props = {
  currentUserId: number | null;
  token: string;
  apiBase: string;
};

type CommentAnchor = { page: number; x: number; y: number; width: number; height: number };
type VisibleTextSuggestion = { original: string } | null;
type SelectedTextLine = { id: string; page: number; text: string; anchor: CommentAnchor };

function linesToAnchor(lines: SelectedTextLine[]): CommentAnchor | null {
  if (lines.length === 0) return null;
  const page = lines[0].page;
  const minX = Math.min(...lines.map(line => line.anchor.x));
  const minY = Math.min(...lines.map(line => line.anchor.y));
  const maxX = Math.max(...lines.map(line => line.anchor.x + line.anchor.width));
  const maxY = Math.max(...lines.map(line => line.anchor.y + line.anchor.height));
  return { page, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function ResumeViewer({ currentUserId, token, apiBase }: Props) {
  const effectiveToken = token || localStorage.getItem("token") || "";
  const h = () => effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } as HeadersInit : {} as HeadersInit;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resumeId = Number(id);

  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [draftAnchor, setDraftAnchor] = useState<CommentAnchor | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [visibleTextSuggestion, setVisibleTextSuggestion] = useState<VisibleTextSuggestion>(null);
  const [visibleSuggestionReplacement, setVisibleSuggestionReplacement] = useState("");
  const [commentKind, setCommentKind] = useState<"comment" | "suggestion">("comment");
  const [selectedTextLines, setSelectedTextLines] = useState<SelectedTextLine[]>([]);
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [latexSource, setLatexSource] = useState("");
  const [landedCompanies, setLandedCompanies] = useState<string[]>([]);
  const [reviewStatus, setReviewStatus] = useState("");
  const [aggregateScore, setAggregateScore] = useState(0);
  const [scoreCount, setScoreCount] = useState(0);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState("");
  const [scoreStatus, setScoreStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [scale, setScale] = useState(1.1);
  const [shareStatus, setShareStatus] = useState("");
  const [selectedResolveIds, setSelectedResolveIds] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalSuggestionRef = useRef<HTMLSpanElement>(null);
  const replacementSuggestionRef = useRef<HTMLTextAreaElement>(null);

  const pageNumbers = useMemo(() => pdf ? Array.from({ length: pdf.numPages }, (_, i) => i + 1) : [], [pdf]);

  useEffect(() => {
    if (!resumeId) return;
    if (!effectiveToken) {
      setLoadError("Sign in to review this resume.");
      return;
    }
    setPdf(null);
    setLoadError("");
    setCommentError("");
    setLatexSource("");
    setRedactions([]);
    setComments([]);
    setSelectedResolveIds([]);
    setLandedCompanies([]);
    setAggregateScore(0);
    setScoreCount(0);
    setUserScore(null);
    setScoreDraft("");
    setScoreStatus("");
    setVisibleTextSuggestion(null);
    setVisibleSuggestionReplacement("");
    setSelectedTextLines([]);
    setCommentKind("comment");
    setDraftBody("");

    // Load PDF file
    fetch(`${apiBase}/resumes/${resumeId}/file`, { headers: h() })
      .then(async r => {
        if (r.ok) return r.arrayBuffer();
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail ?? "Could not load this PDF.");
      })
      .then(data => loadPdfDocument(data))
      .then(setPdf)
      .catch((error: Error) => {
        setLoadError(error.message || "Could not load this PDF.");
      });

    // Load resume metadata (works for owner + public resumes)
    fetch(`${apiBase}/resumes/${resumeId}`, { headers: h() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((meta: any) => {
        setResumeTitle(meta.title || meta.file_name);
        setReviewStatus(meta.review_status);
        setIsOwner(meta.user_id === currentUserId);
        setRedactions(meta.redactions || []);
        setLatexSource(meta.latex_source || "");
        setLandedCompanies(meta.landed_companies || []);
        setAggregateScore(meta.aggregate_score ?? 0);
        setScoreCount(meta.score_count ?? 0);
        setUserScore(meta.user_score ?? null);
        setScoreDraft(meta.user_score != null ? String(meta.user_score) : "");
      })
      .catch(() => { });

    // Load comments
    fetch(`${apiBase}/resumes/${resumeId}/comments`, { headers: h() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setComments(data);
        setSelectedResolveIds([]);
      });
  }, [resumeId, currentUserId, effectiveToken]);

  const refreshComments = async () => {
    if (!effectiveToken) return;
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments`, { headers: h() });
    if (res.ok) {
      const data: Comment[] = await res.json();
      setComments(data);
      const available = new Set(data.filter(canResolveComment).map(c => c.id));
      setSelectedResolveIds(ids => ids.filter(id => available.has(id)));
    }
  };

  const handleTextLinesSelect = (lines: SelectedTextLine[]) => {
    const sorted = [...lines].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x);
    const text = sorted.map(item => item.text).join("\n");
    setSelectedTextLines(sorted);
    setVisibleTextSuggestion(text ? { original: text } : null);
    setVisibleSuggestionReplacement(text);
    setDraftAnchor(linesToAnchor(sorted));
    setCommentError("");
    if (sorted.length > 0) setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const clearDraft = () => {
    setDraftAnchor(null);
    setDraftBody("");
    setVisibleTextSuggestion(null);
    setVisibleSuggestionReplacement("");
    setSelectedTextLines([]);
    setCommentKind("comment");
    setCommentError("");
  };

  const useSuggestionForDraft = () => {
    setCommentKind("suggestion");
    if (visibleTextSuggestion) {
      setVisibleSuggestionReplacement(current => current || visibleTextSuggestion.original);
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const syncSuggestionScroll = (source: HTMLElement, target: HTMLElement | null) => {
    if (!target) return;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  };

  const submitComment = async () => {
    if (!draftAnchor || !draftBody.trim()) return;
    if (!effectiveToken) {
      setCommentError("Please sign in again before posting a comment.");
      return;
    }
    const replacement = visibleSuggestionReplacement.trim();
    const includeSuggestion = commentKind === "suggestion" && visibleTextSuggestion && replacement && replacement !== visibleTextSuggestion.original;
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({
        body: draftBody.trim(),
        ...draftAnchor,
        ...(includeSuggestion ? {
          suggestion_original: visibleTextSuggestion.original,
          suggestion_replacement: replacement,
        } : {}),
      }),
    });
    if (res.ok) {
      clearDraft();
      await refreshComments();
    } else {
      const error = await res.json().catch(() => null);
      setCommentError(formatApiError(error?.detail ?? "Could not post this suggestion."));
    }
  };

  const resolveComment = async (commentId: number) => {
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments/${commentId}/resolve`, {
      method: "PATCH", headers: h(),
    });
    if (res.ok) await refreshComments();
  };

  const resolveSelectedComments = async () => {
    if (selectedResolveIds.length === 0) return;
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ comment_ids: selectedResolveIds }),
    });
    if (res.ok) {
      setSelectedResolveIds([]);
      await refreshComments();
    }
  };

  const shareResume = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Copied");
    } catch {
      setShareStatus(url);
    }
    window.setTimeout(() => setShareStatus(""), 2200);
  };

  const submitScore = async () => {
    const score = Number(scoreDraft);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setScoreStatus("Use a whole number from 0 to 100.");
      return;
    }
    const res = await fetch(`${apiBase}/resumes/${resumeId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...h() },
      body: JSON.stringify({ score }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setScoreStatus(payload?.detail ?? "Could not save score.");
      return;
    }
    setUserScore(payload.user_score);
    setAggregateScore(payload.aggregate_score);
    setScoreCount(payload.score_count);
    setScoreDraft(String(payload.user_score));
    setScoreStatus("Saved");
    window.setTimeout(() => setScoreStatus(""), 1800);
  };

  const voteComment = async (commentId: number, vote: number) => {
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ vote }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.deleted) {
        setComments(c => c.filter(x => x.id !== commentId));
      } else if (data.comment) {
        setComments(c => c.map(x => x.id === commentId ? data.comment : x));
      }
    }
  };

  const submitReply = async (commentId: number) => {
    if (!replyBody.trim()) return;
    const res = await fetch(`${apiBase}/resumes/${resumeId}/comments/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ body: replyBody.trim() }),
    });
    if (res.ok) {
      setReplyBody("");
      setActiveReplyId(null);
      await refreshComments();
    }
  };

  const resubmit = async () => {
    const res = await fetch(`${apiBase}/resumes/${resumeId}/resubmit`, { method: "PATCH", headers: h() });
    if (res.ok) { setReviewStatus("ready_for_review"); await refreshComments(); }
  };

  const canResolveComment = (c: Comment) => (
    c.status === "open" &&
    c.author_id === currentUserId &&
    Boolean(c.resolved_by_resume_id)
  );
  const visibleComments = comments.filter(c => c.status === (tab === "open" ? "open" : "resolved"));
  const resolvableVisibleComments = visibleComments.filter(canResolveComment);
  const selectedResolveComments = comments.filter(c => selectedResolveIds.includes(c.id));
  const allResolvableSelected = resolvableVisibleComments.length > 0 && resolvableVisibleComments.every(c => selectedResolveIds.includes(c.id));
  const openCount = comments.filter(c => c.status === "open").length;
  const resolvedCount = comments.filter(c => c.status === "resolved").length;
  const canResubmit = isOwner && openCount === 0 && resolvedCount > 0 && reviewStatus !== "ready_for_review";

  const toggleResolveSelection = (commentId: number) => {
    setSelectedResolveIds(ids => ids.includes(commentId) ? ids.filter(id => id !== commentId) : [...ids, commentId]);
  };

  const toggleAllResolvable = () => {
    if (allResolvableSelected) {
      const visibleIds = new Set(resolvableVisibleComments.map(c => c.id));
      setSelectedResolveIds(ids => ids.filter(id => !visibleIds.has(id)));
    } else {
      setSelectedResolveIds(ids => Array.from(new Set([...ids, ...resolvableVisibleComments.map(c => c.id)])));
    }
  };

  function formatApiError(detail: unknown) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item: any) => item?.msg || item?.message || String(item)).join(" ");
    return "Could not post this suggestion.";
  }

  return (
    <div className="viewer-layout">
      {/* PDF Panel */}
      <div className="viewer-pdf">
        <div className="toolbar viewer-toolbar" style={{ top: 0 }}>
          <button className="icon-btn viewer-back-btn" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
          <div className="viewer-title-block">
            <div className="viewer-title-row">
              <strong>{resumeTitle || "Resume"}</strong>
              <span className="resume-score-badge"><Star size={13} />{aggregateScore} score · {scoreCount} rating{scoreCount === 1 ? "" : "s"}</span>
              {landedCompanies.length > 0 && (
                <div className="toolbar-tags">
                  {landedCompanies.map(company => <span key={company} className="company-tag"><Briefcase size={11} />{company}</span>)}
                </div>
              )}
            </div>
          </div>
          <div className="viewer-toolbar-actions">
            <div className="zoom-control viewer-zoom-control" aria-label="Zoom controls">
              <button aria-label="Zoom out" onClick={() => setScale(v => Math.max(0.75, v - 0.15))}>−</button>
              <span>{Math.round(scale * 100)}%</span>
              <button aria-label="Zoom in" onClick={() => setScale(v => Math.min(2, v + 0.15))}>+</button>
            </div>
            <div className="share-control">
              <button className="secondary-button" onClick={shareResume}><Share2 size={14} /> Share</button>
              {shareStatus && <span className="viewer-share-status">{shareStatus}</span>}
            </div>
            {isOwner && (
              <button className="secondary-button" onClick={() => navigate(`/upload?edit=${resumeId}`)}>
                Edit LaTeX
              </button>
            )}
          </div>
        </div>
        <div className="document-stage">
          {loadError ? (
            <div className="empty-state">
              <FileWarning />
              <h3>PDF Unavailable</h3>
              <p>{loadError}</p>
            </div>
          ) : pdf ? (
            <div className="pages">
              {pageNumbers.map(n => (
                <PdfPage
                  key={n}
                  pdf={pdf}
                  pageNumber={n}
                  scale={scale}
                  redactions={redactions.filter(r => r.page === n)}
                  addRedaction={() => { }}
                  removeRedaction={() => { }}
                  readOnly={true}
                  commentMode={!isOwner}
                  comments={visibleComments.filter(c => c.page === n)}
                  activeCommentId={activeCommentId}
                  selectedTextLineIds={selectedTextLines.filter(line => line.page === n).map(line => line.id)}
                  onTextLinesSelect={handleTextLinesSelect}
                  onCommentClick={cid => { setActiveCommentId(cid); setTab(comments.find(c => c.id === cid)?.status === "resolved" ? "resolved" : "open"); }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>Loading resume…</p></div>
          )}
        </div>
      </div>

      {/* Comment Sidebar */}
      <aside className={`comment-sidebar ${draftAnchor && visibleTextSuggestion ? "composing" : ""}`}>
          <div className="comment-sidebar-header">
          <div className="resume-score-panel">
            <div>
              <span>Overall score</span>
              <strong>{aggregateScore}</strong>
              <small>{scoreCount} user rating{scoreCount === 1 ? "" : "s"}</small>
            </div>
            <label className="score-slider-field">
              <span>Your score <strong>{scoreDraft || "0"}</strong></span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={scoreDraft}
                onChange={e => setScoreDraft(e.target.value)}
                aria-label="Your score"
              />
            </label>
            <button className="secondary-button" onClick={submitScore}>
              <Star size={13} /> {userScore == null ? "Leave score" : "Update"}
            </button>
            {scoreStatus && <small className="score-status">{scoreStatus}</small>}
          </div>
          <div className="issue-console-heading">
            <div>
              <h3>Issues</h3>
              <span>Review thread</span>
            </div>
            <div className="issue-console-counts">
              <span style={{ textAlign: "center" }}>{openCount} open</span>
              <span style={{ textAlign: "center" }}>{resolvedCount} resolved</span>
            </div>
          </div>
          <div className="comment-tabs">
            <button className={`comment-tab ${tab === "open" ? "active" : ""}`} onClick={() => setTab("open")}>
              Open ({openCount})
            </button>
            <button className={`comment-tab ${tab === "resolved" ? "active" : ""}`} onClick={() => setTab("resolved")}>
              Resolved ({resolvedCount})
            </button>
          </div>
          {resolvableVisibleComments.length > 0 && (
            <div className="bulk-resolve-bar">
              <div className="bulk-resolve-actions">
                <button className="text-btn bulk-select-btn" onClick={toggleAllResolvable}>
                  {allResolvableSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allResolvableSelected ? "Clear" : "Select ready"}
                </button>
                <button className="primary-button" disabled={selectedResolveIds.length === 0} onClick={resolveSelectedComments}>
                  <CheckCircle size={14} /> Resolve {selectedResolveIds.length || ""}
                </button>
              </div>
              {selectedResolveComments.length > 0 && (
                <div className="bulk-resolve-preview">
                  {selectedResolveComments.map(comment => (
                    <div key={comment.id} className="bulk-resolve-preview-item">
                      <strong>Issue #{comment.id}</strong>
                      <span>{comment.body}</span>
                      {comment.suggestion_status !== "none" && (
                        <div className="bulk-resolve-suggestion">
                          <pre className="suggestion-original">{comment.suggestion_original}</pre>
                          <pre className="suggestion-replacement">{comment.suggestion_replacement}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="comment-list">
          {visibleComments.length === 0 ? (
            <div className="empty-state small" style={{ minHeight: 120 }}>
              <MessageSquare size={28} />
              <p>{tab === "open" ? "No open issues yet." : "No resolved issues."}</p>
            </div>
          ) : (
            visibleComments.map((c, i) => (
              <div
                key={c.id}
                className={`comment-card ${c.status} ${activeCommentId === c.id ? "active" : ""}`}
                onClick={() => setActiveCommentId(activeCommentId === c.id ? null : c.id)}
              >
                <div className="comment-card-head">
                  <div className="comment-card-number">{i + 1}</div>
                  <div className="comment-card-meta">
                    {c.author_display_name} · Page {c.page} · {new Date(c.created_at).toLocaleDateString()}
                  </div>
                  {canResolveComment(c) && (
                    <button
                      className={`resolve-select-btn ${selectedResolveIds.includes(c.id) ? "selected" : ""}`}
                      onClick={e => { e.stopPropagation(); toggleResolveSelection(c.id); }}
                      aria-label={selectedResolveIds.includes(c.id) ? "Remove from bulk resolve" : "Select for bulk resolve"}
                    >
                      {selectedResolveIds.includes(c.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  )}
                </div>
                <div className="comment-card-body">{c.body}</div>
                {c.suggestion_status !== "none" && (
                  <div className={`latex-suggestion-card ${c.suggestion_status}`} onClick={e => e.stopPropagation()}>
                    <div className="suggestion-header">
                      <span><Wand2 size={13} /> Suggested change</span>
                      <strong>{c.suggestion_status}</strong>
                    </div>
                    <div className="suggestion-diff">
                      <pre className="suggestion-original">{c.suggestion_original}</pre>
                      <pre className="suggestion-replacement">{c.suggestion_replacement}</pre>
                    </div>
                  </div>
                )}
                {c.resolved_by_resume_id && (
                  <div className="linked-fix-card" onClick={e => e.stopPropagation()}>
                    <GitPullRequest size={14} />
                    <div>
                      <span>Proposed fix uploaded</span>
                      <button className="text-btn" onClick={() => navigate(`/resume/${c.resolved_by_resume_id}`)}>
                        View {c.resolved_by_resume_title || "revision"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies Section */}
                {c.replies && c.replies.length > 0 && (
                  <div className="comment-replies" onClick={e => e.stopPropagation()}>
                    {c.replies.map((r, ri) => (
                      <div key={r.id} className="comment-reply">
                        <div className="comment-card-meta">
                          {r.author_display_name} · {new Date(r.created_at).toLocaleDateString()}
                        </div>
                        <div className="comment-card-body" style={{ margin: "4px 0 0" }}>{r.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Voting & Actions */}
                <div className="comment-actions" onClick={e => e.stopPropagation()}>
                  <div className="vote-buttons">
                    <button
                      className={`vote-btn ${c.user_vote === 1 ? "active" : ""}`} 
                      onClick={() => voteComment(c.id, c.user_vote === 1 ? 0 : 1)}
                      aria-label="Upvote"
                    >▲ {c.upvotes}</button>
                    <button
                      className={`vote-btn ${c.user_vote === -1 ? "active" : ""}`} 
                      onClick={() => voteComment(c.id, c.user_vote === -1 ? 0 : -1)}
                      aria-label="Downvote"
                    >▼ {c.downvotes}</button>
                  </div>
                  <button className="text-btn" onClick={() => { setActiveReplyId(c.id); setReplyBody(""); }}>Reply</button>
                  {c.status === "open" && isOwner && !c.resolved_by_resume_id && (
                    <button className="text-btn" style={{ marginLeft: "auto", color: "var(--accent)" }} onClick={() => navigate("/upload", { state: { resolvesCommentId: c.id } })}>
                      Upload Fix
                    </button>
                  )}
                  {canResolveComment(c) && (
                    <button className="text-btn resolve-btn" onClick={() => resolveComment(c.id)}>
                      <CheckCircle size={13} /> Resolve
                    </button>
                  )}
                </div>

                {/* Reply Input */}
                {activeReplyId === c.id && (
                  <div className="reply-input-box" onClick={e => e.stopPropagation()}>
                    <textarea
                      autoFocus
                      placeholder="Write a reply..."
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      rows={2}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="secondary-button" onClick={() => setActiveReplyId(null)}>Cancel</button>
                      <button className="primary-button" disabled={!replyBody.trim()} onClick={() => submitReply(c.id)}>Post</button>
                    </div>
                  </div>
                )}

                {c.status === "resolved" && (
                  <p className="comment-resolved-note">
                    ✓ Resolved by {c.resolved_by_display_name}
                    {c.resolved_by_resume_id && (
                      <> — <a href={`/resume/${c.resolved_by_resume_id}`} className="text-btn" style={{ display: "inline", padding: 0, fontSize: "inherit", textTransform: "none", letterSpacing: 0 }} onClick={e => { e.stopPropagation(); navigate(`/resume/${c.resolved_by_resume_id}`); }}>View Revision →</a></>
                    )}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add comment form (reviewers only) */}
        {!isOwner && (
          <div className="add-comment-form">
            {draftAnchor && visibleTextSuggestion ? (
              <>
                <div className="comment-kind-toggle" aria-label="Comment type">
                  <button className={commentKind === "comment" ? "selected" : ""} onClick={() => setCommentKind("comment")}>General comment</button>
                  <button className={commentKind === "suggestion" ? "selected" : ""} onClick={useSuggestionForDraft}>Suggest change</button>
                </div>
                <div className="visible-suggestion-box">
                  <p>{selectedTextLines.length} selected line{selectedTextLines.length === 1 ? "" : "s"}</p>
                  <div className={commentKind === "suggestion" ? "visible-suggestion-row" : "visible-selection-preview"}>
                    <span
                      ref={originalSuggestionRef}
                      onScroll={e => syncSuggestionScroll(e.currentTarget, replacementSuggestionRef.current)}
                    >
                      {visibleTextSuggestion.original}
                    </span>
                    {commentKind === "suggestion" && (
                      <textarea
                        ref={replacementSuggestionRef}
                        value={visibleSuggestionReplacement}
                        onChange={e => setVisibleSuggestionReplacement(e.target.value)}
                        onScroll={e => syncSuggestionScroll(e.currentTarget, originalSuggestionRef.current)}
                        maxLength={2000}
                        aria-label="Suggested replacement"
                        rows={Math.min(5, Math.max(2, selectedTextLines.length))}
                      />
                    )}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  placeholder={commentKind === "suggestion" ? "Explain why this wording is stronger..." : "Write your comment..."}
                  rows={3}
                  maxLength={2000}
                />
                {commentError && <p className="comment-submit-error" role="alert">{commentError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary-button" onClick={clearDraft} style={{ flex: 1 }}>Cancel</button>
                  <button
                    className="primary-button"
                    onClick={submitComment}
                    disabled={!draftBody.trim() || Boolean(commentKind === "suggestion" && visibleSuggestionReplacement.trim() === visibleTextSuggestion.original)}
                    style={{ flex: 1 }}
                  >
                    <Send size={13} /> {commentKind === "suggestion" ? "Suggest" : "Comment"}
                  </button>
                </div>
              </>
            ) : (
              <p className="comment-hint">Select one or more resume lines to leave a general comment or suggest replacement text.</p>
            )}
          </div>
        )}

        {/* Resubmit bar (owner only) */}
        {canResubmit && (
          <div className="resubmit-bar">
            <p>All comments resolved — ready to resubmit for review.</p>
            <button className="primary-button" onClick={resubmit}><RotateCcw size={14} /> Resubmit for Review</button>
          </div>
        )}
      </aside>
    </div>
  );
}
