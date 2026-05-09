import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Clock, Users as UsersIcon, Search, ChevronRight, MessageSquare, Briefcase, ThumbsDown } from "lucide-react";
import { FAANG_PLUS_COMPANIES } from "../constants";
import type { BrowseResume } from "../types";



type Props = { token: string; apiBase: string };

export function BrowsePage({ token, apiBase }: Props) {
  const h = (): HeadersInit => token ? { Authorization: `Bearer ${token}` } : {};
  const [resumes, setResumes] = useState<BrowseResume[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("downvotes");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const navigate = useNavigate();

  const companyOptions = useMemo(() => {
    const fromResumes = resumes.flatMap(r => r.landed_companies || []);
    return Array.from(new Map([...FAANG_PLUS_COMPANIES, ...fromResumes].map(company => [company.toLowerCase(), company])).values())
      .filter(company => !companyFilter || company.toLowerCase().includes(companyFilter.toLowerCase()))
      .slice(0, 8);
  }, [resumes, companyFilter]);

  const selectCompany = (company: string) => {
    setCompanyFilter(company);
    setShowCompanySuggestions(false);
    load(search, sort, company);
  };

  const load = useCallback(async (s = search, so = sort, company = companyFilter) => {
    const params = new URLSearchParams({ sort: so });
    if (s) params.set("search", s);
    if (company) params.set("company", company);
    const res = await fetch(`${apiBase}/resumes/browse?${params}`, { headers: h() });
    if (res.ok) setResumes(await res.json());
  }, [token, apiBase, search, sort, companyFilter]);

  useEffect(() => { load(); }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Browse Resumes</h2>
          <p className="page-subtitle">Discover and review resumes from the community</p>
        </div>
      </div>

      <div className="browse-toolbar">
        <div className="search-input-wrap">
          <Search size={15} color="var(--muted)" />
          <input
            placeholder="Search by title or filename..."
            value={search}
            onChange={e => { setSearch(e.target.value); load(e.target.value, sort, companyFilter); }}
          />
        </div>
        <select className="sort-select" value={sort} onChange={e => { setSort(e.target.value); load(search, e.target.value, companyFilter); }}>
          <option value="downvotes">Most Downvoted</option>
          <option value="popular">Most Activity</option>
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="name">Name A–Z</option>
        </select>
        <div className="company-autocomplete">
          <input
            className="company-filter-input"
            placeholder="Search company"
            value={companyFilter}
            maxLength={80}
            role="combobox"
            aria-expanded={showCompanySuggestions}
            aria-controls="company-autocomplete-options"
            onFocus={() => setShowCompanySuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowCompanySuggestions(false), 120)}
            onChange={e => {
              setCompanyFilter(e.target.value);
              setShowCompanySuggestions(true);
              load(search, sort, e.target.value);
            }}
          />
          {showCompanySuggestions && (companyOptions.length > 0 || companyFilter) && (
            <div className="company-autocomplete-menu" id="company-autocomplete-options" role="listbox">
              {companyOptions.map(company => (
                <button key={company} type="button" role="option" onMouseDown={e => e.preventDefault()} onClick={() => selectCompany(company)}>
                  <Briefcase size={13} />{company}
                </button>
              ))}
              {companyFilter.trim() && !companyOptions.some(company => company.toLowerCase() === companyFilter.trim().toLowerCase()) && (
                <button type="button" role="option" onMouseDown={e => e.preventDefault()} onClick={() => selectCompany(companyFilter.trim())}>
                  Search "{companyFilter.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="empty-state">
          <UsersIcon />
          <h3>No Resumes Found</h3>
          <p>Try a different search or filter, or upload your own resume.</p>
        </div>
      ) : (
        <div className="resume-grid">
          {resumes.map(r => (
            <button key={r.id} className="resume-card browse-card" onClick={() => navigate(`/resume/${r.id}`)}>
              <div className="icon-btn" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-dim)", color: "var(--accent)", border: "none" }}>
                <FileText size={24} />
              </div>
              <div className="card-body">
                <strong>{r.title || r.file_name}</strong>
                {r.title && <span className="card-meta" style={{ opacity: 0.6 }}>{r.file_name}</span>}
                <span className="card-meta"><UsersIcon size={13} />{r.owner_display_name ?? "Anonymous"}</span>
                <span className="card-meta"><Clock size={13} />{new Date(r.created_at).toLocaleDateString()}</span>
                {(r.landed_companies || []).length > 0 && (
                  <div className="company-tag-row">
                    {r.landed_companies.map(company => <span key={company} className="company-tag"><Briefcase size={11} />{company}</span>)}
                  </div>
                )}
                {r.open_comment_count > 0 && (
                  <span className="comment-count-badge"><MessageSquare size={12} />{r.open_comment_count} open</span>
                )}
                <span className="card-meta"><MessageSquare size={13} />{r.comment_count} total comment{r.comment_count === 1 ? "" : "s"}</span>
                <span className="card-meta"><ThumbsDown size={13} />{r.downvote_count} downvote{r.downvote_count === 1 ? "" : "s"}</span>
              </div>
              <ChevronRight size={16} className="card-chevron" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
