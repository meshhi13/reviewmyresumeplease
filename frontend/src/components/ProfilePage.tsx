import { useState, useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { FileText, Clock, LogOut, Upload, Eye, EyeOff, MessageSquare, Edit2, Check, X, RotateCcw, Trash2, Briefcase, GitBranch, GitCommit, Star } from "lucide-react";
import { FAANG_PLUS_COMPANIES } from "../constants";
import type { SavedResume } from "../types";



type Props = {
  user: { id: number; email: string; display_name: string } | null;
  setUser: React.Dispatch<React.SetStateAction<{ id: number; email: string; display_name: string } | null>>;
  savedResumes: SavedResume[];
  setSavedResumes: React.Dispatch<React.SetStateAction<SavedResume[]>>;
  token: string;
  apiBase: string;
  onSignOut: () => void;
};

export function ProfilePage({ user, setUser, savedResumes, setSavedResumes, token, apiBase, onSignOut }: Props) {
  const h = (): HeadersInit => token ? { Authorization: `Bearer ${token}` } : {};
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user?.display_name || "");
  const [profileStatus, setProfileStatus] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingCompaniesId, setEditingCompaniesId] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState<string[]>([]);
  const [customCompanyDraft, setCustomCompanyDraft] = useState("");

  const resumeTree = useMemo(() => {
    const childrenByParent = new Map<number, SavedResume[]>();
    const ids = new Set(savedResumes.map(r => r.id));
    const roots: SavedResume[] = [];

    savedResumes.forEach(resume => {
      if (resume.fix_parent_resume_id && ids.has(resume.fix_parent_resume_id)) {
        const children = childrenByParent.get(resume.fix_parent_resume_id) || [];
        children.push(resume);
        childrenByParent.set(resume.fix_parent_resume_id, children);
      } else if (!resume.fix_parent_resume_id) {
        roots.push(resume);
      }
    });

    return { roots, childrenByParent };
  }, [savedResumes]);

  const startUsernameEdit = () => {
    setUsernameDraft(user?.display_name || "");
    setProfileStatus("");
    setEditingUsername(true);
  };

  const saveUsername = async (displayName = usernameDraft) => {
    const cleaned = displayName.trim().replace(/\s+/g, " ");
    const res = await fetch(`${apiBase}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ display_name: cleaned }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setProfileStatus(payload?.detail ?? "Could not update your username.");
      return;
    }
    setUser(payload);
    setUsernameDraft(payload.display_name || "");
    setEditingUsername(false);
    setProfileStatus(cleaned ? "Username updated." : "Username removed.");
  };

  const removeUsername = () => {
    setUsernameDraft("");
    saveUsername("");
  };

  const startRename = (r: SavedResume) => {
    setRenamingId(r.id);
    setRenameValue(r.title || r.file_name);
  };

  const submitRename = async (id: number) => {
    const res = await fetch(`${apiBase}/resumes/${id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ title: renameValue }),
    });
    if (res.ok) {
      setSavedResumes(prev => prev.map(r => r.id === id ? { ...r, title: renameValue } : r));
    }
    setRenamingId(null);
  };

  const startCompanyEdit = (r: SavedResume) => {
    setEditingCompaniesId(r.id);
    setCompanyDraft(r.landed_companies || []);
    setCustomCompanyDraft("");
  };

  const toggleCompanyDraft = (company: string) => {
    setCompanyDraft(current =>
      current.includes(company) ? current.filter(c => c !== company) : [...current, company]
    );
  };

  const addCustomCompanyDraft = () => {
    const company = customCompanyDraft.trim().replace(/\s+/g, " ");
    if (!company) return;
    setCompanyDraft(current =>
      current.some(c => c.toLowerCase() === company.toLowerCase()) ? current : [...current, company]
    );
    setCustomCompanyDraft("");
  };

  const submitCompanies = async (id: number) => {
    const res = await fetch(`${apiBase}/resumes/${id}/landed-companies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(h()) },
      body: JSON.stringify({ landed_companies: companyDraft }),
    });
    if (res.ok) {
      const updated: SavedResume = await res.json();
      setSavedResumes(prev => prev.map(r => r.id === id ? updated : r));
    }
    setEditingCompaniesId(null);
  };

  const togglePrivate = useCallback(async (id: number) => {
    const res = await fetch(`${apiBase}/resumes/${id}/anonymized`, {
      method: "PATCH", headers: h(),
    });
    if (res.ok) {
      const { anonymized } = await res.json();
      setSavedResumes(prev => prev.map(r => r.id === id ? { ...r, anonymized } : r));
    }
  }, [apiBase, token, setSavedResumes]);

  const deleteResume = async (id: number) => {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    const res = await fetch(`${apiBase}/resumes/${id}`, { method: "DELETE", headers: h() });
    if (res.ok) setSavedResumes(prev => prev.filter(r => r.id !== id));
  };

  const resubmit = async (id: number) => {
    const res = await fetch(`${apiBase}/resumes/${id}/resubmit`, { method: "PATCH", headers: h() });
    if (res.ok) {
      setSavedResumes(prev => prev.map(r => r.id === id ? { ...r, review_status: "ready_for_review" } : r));
    }
  };

  const renderResumeCard = (r: SavedResume, depth = 0): ReactElement => (
    <div key={r.id} className={`profile-tree-node depth-${Math.min(depth, 3)}`}>
      <div className="resume-card profile-card">
        {depth > 0 && (
          <div className="revision-chip">
            <GitCommit size={13} /> Fixes issue #{r.fixes_comment_id}
          </div>
        )}
        {/* Top: icon + privacy toggle */}
        <div className="card-top">
          <div className="profile-resume-icon">
            {depth > 0 ? <GitCommit size={22} /> : <FileText size={22} />}
          </div>
          <div className="profile-card-visibility">
            <span>{r.anonymized ? "Private" : "Public"}</span>
            <button className="icon-btn" title={r.anonymized ? "Private — click to make public" : "Public — click to make private"} onClick={() => togglePrivate(r.id)}>
              {r.anonymized ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Middle: title + meta */}
        <div className="card-body">
          {renamingId === r.id ? (
            <div className="inline-rename">
              <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitRename(r.id); if (e.key === "Escape") setRenamingId(null); }}
                maxLength={255} />
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => submitRename(r.id)}><Check size={13} /></button>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setRenamingId(null)}><X size={13} /></button>
            </div>
          ) : (
            <div className="profile-title-row">
              <strong>{r.title || r.file_name}</strong>
              <button className="icon-btn rename-trigger" title="Rename resume" onClick={() => startRename(r)}><Edit2 size={12} /></button>
            </div>
          )}
          {r.fix_parent_resume_title && (
            <span className="card-meta"><GitBranch size={13} />Revision of {r.fix_parent_resume_title}</span>
          )}
          <div className="profile-card-meta-row">
            <span className="card-meta"><Clock size={13} />{new Date(r.created_at).toLocaleDateString()}</span>
            <span className="card-meta"><FileText size={13} />{r.source_format === "latex" ? "LaTeX source" : "PDF upload"}</span>
          </div>
          <div className="company-tag-row">
            {(r.landed_companies || []).length > 0 ? (
              r.landed_companies.map(company => <span key={company} className="company-tag"><Briefcase size={11} />{company}</span>)
            ) : (
              <span className="card-meta"><Briefcase size={13} />No landed company tagged</span>
            )}
          </div>
          {editingCompaniesId === r.id ? (
            <div className="company-editor">
              <div className="company-chip-grid compact">
                {FAANG_PLUS_COMPANIES.map(company => (
                  <button
                    key={company}
                    type="button"
                    className={`company-chip ${companyDraft.includes(company) ? "selected" : ""}`}
                    onClick={() => toggleCompanyDraft(company)}
                  >
                    {company}
                  </button>
                ))}
                {companyDraft.filter(company => !FAANG_PLUS_COMPANIES.some(known => known.toLowerCase() === company.toLowerCase())).map(company => (
                  <button
                    key={company}
                    type="button"
                    className="company-chip selected"
                    onClick={() => toggleCompanyDraft(company)}
                  >
                    {company}
                  </button>
                ))}
              </div>
              <div className="custom-company-row">
                <input
                  placeholder="Custom company"
                  value={customCompanyDraft}
                  maxLength={80}
                  onChange={e => setCustomCompanyDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomCompanyDraft(); } }}
                />
                <button type="button" className="secondary-button" onClick={addCustomCompanyDraft}>Add</button>
              </div>
              <div className="inline-actions">
                <button className="secondary-button" onClick={() => setEditingCompaniesId(null)}><X size={13} /> Cancel</button>
                <button className="primary-button" onClick={() => submitCompanies(r.id)}><Check size={13} /> Save</button>
              </div>
            </div>
          ) : (
            <button className="text-btn company-edit-btn" onClick={() => startCompanyEdit(r)}>Edit landed companies</button>
          )}
        </div>

        {/* Bottom: status badges + actions */}
        <div className="card-footer">
          <div className="card-badges">
            <span className={`status-badge ${r.review_status.replace(/_/g, "-")}`}>{r.review_status.replace(/_/g, " ")}</span>
            <span className="resume-score-badge"><Star size={12} />{r.aggregate_score} score</span>
            {r.open_comment_count > 0 && (
              <span className="comment-count-badge"><MessageSquare size={12} />{r.open_comment_count} open</span>
            )}
          </div>
          <div className="card-actions">
            {r.open_comment_count === 0 && r.review_status !== "ready_for_review" && (
              <button className="icon-btn" title="Resubmit for review" onClick={() => resubmit(r.id)}><RotateCcw size={16} /></button>
            )}
            <Link to={`/app/resume/${r.id}`} className="secondary-button compact-action">View</Link>
            <Link to={`/app/upload?edit=${r.id}`} className="secondary-button compact-action">Edit LaTeX</Link>
            <button className="icon-btn" title="Delete resume" style={{ color: "#c0392b", borderColor: "rgba(192,57,43,0.3)" }} onClick={() => deleteResume(r.id)}><Trash2 size={16} /></button>
          </div>
        </div>
      </div>
      {(resumeTree.childrenByParent.get(r.id) || []).length > 0 && (
        <div className="profile-tree-children">
          {(resumeTree.childrenByParent.get(r.id) || []).map(child => renderResumeCard(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h2>My Profile</h2><p className="page-subtitle">Manage your resumes and visibility</p></div>
      </div>

      <div className="profile-info-card">
        <div className="profile-avatar">{(user?.display_name || user?.email)?.charAt(0)?.toUpperCase() ?? "?"}</div>
        <div className="profile-details">
          {editingUsername ? (
            <div className="profile-username-editor">
              <input
                autoFocus
                maxLength={120}
                placeholder="Username"
                value={usernameDraft}
                onChange={e => setUsernameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveUsername();
                  if (e.key === "Escape") setEditingUsername(false);
                }}
              />
              <button className="icon-btn" title="Save username" onClick={() => saveUsername()}><Check size={14} /></button>
              <button className="icon-btn" title="Cancel" onClick={() => setEditingUsername(false)}><X size={14} /></button>
            </div>
          ) : (
            <div className="profile-username-row">
              <h3>{user?.display_name || "No username set"}</h3>
              <button className="icon-btn" title="Edit username" onClick={startUsernameEdit}><Edit2 size={13} /></button>
              {user?.display_name && (
                <button className="icon-btn danger" title="Remove username" onClick={removeUsername}><Trash2 size={13} /></button>
              )}
            </div>
          )}
          <p>{user?.email}</p>
          {profileStatus && <span className="profile-status">{profileStatus}</span>}
        </div>
        <button className="secondary-button signout-btn" onClick={onSignOut}><LogOut size={14} /> Sign Out</button>
      </div>

      <div className="profile-section-header">
        <h3>Your Resumes</h3>
        <span className="badge">{savedResumes.length}</span>
      </div>

      {savedResumes.length === 0 ? (
        <div className="empty-state small">
          <FileText />
          <h3>No Resumes Yet</h3>
          <p>Upload your first resume to get started with peer reviews.</p>
          <Link to="/app/upload" className="primary-button"><Upload size={14} /> Upload a Resume</Link>
        </div>
      ) : (
        <div className="profile-tree">
          {resumeTree.roots.map(r => renderResumeCard(r))}
        </div>
      )}
    </div>
  );
}
