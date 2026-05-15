import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Clock, Users as UsersIcon, Search, ChevronRight, MessageSquare, Briefcase, ThumbsDown, Star, GraduationCap } from "lucide-react";
import { FIELD_CATEGORIES, companiesForFieldCategory, fieldCategoryLabel } from "../constants";
import type { BrowseResume } from "../types";



type Props = { token: string; apiBase: string };

export function BrowsePage({ token, apiBase }: Props) {
  const h = (): HeadersInit => token ? { Authorization: `Bearer ${token}` } : {};
  const [resumes, setResumes] = useState<BrowseResume[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [fieldCategory, setFieldCategory] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const navigate = useNavigate();

  const companyOptions = useMemo(() => {
    const fromResumes = resumes.flatMap(r => r.landed_companies || []);
    return Array.from(new Map([...companiesForFieldCategory(fieldCategory), ...fromResumes].map(company => [company.toLowerCase(), company])).values())
      .filter(company => !companyFilter || company.toLowerCase().includes(companyFilter.toLowerCase()))
      .slice(0, 8);
  }, [resumes, companyFilter, fieldCategory]);

  const selectCompany = (company: string) => {
    setCompanyFilter(company);
    setShowCompanySuggestions(false);
    load(search, sort, fieldCategory, company, minScore);
  };

  const load = useCallback(async (s = search, so = sort, category = fieldCategory, company = companyFilter, score = minScore) => {
    if (!category) {
      setResumes([]);
      return;
    }
    const params = new URLSearchParams({ sort: so, field_category: category });
    if (s) params.set("search", s);
    if (company) params.set("company", company);
    if (score) params.set("min_score", score);
    const res = await fetch(`${apiBase}/resumes/browse?${params}`, { headers: h() });
    if (res.ok) setResumes(await res.json());
  }, [token, apiBase, search, sort, fieldCategory, companyFilter, minScore]);

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
            onChange={e => { setSearch(e.target.value); load(e.target.value, sort, fieldCategory, companyFilter, minScore); }}
          />
        </div>
        <select className="sort-select category-select" value={fieldCategory} onChange={e => { setFieldCategory(e.target.value); setCompanyFilter(""); load(search, sort, e.target.value, "", minScore); }}>
          <option value="">Select Field</option>
          {FIELD_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
        <select className="sort-select" value={sort} onChange={e => { setSort(e.target.value); load(search, e.target.value, fieldCategory, companyFilter, minScore); }}>
          <option value="popular">Most Activity</option>
          <option value="score">Highest Score</option>
          <option value="downvotes">Most Downvoted</option>
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="name">Name A–Z</option>
        </select>
        <label className="score-filter">
          <Star size={14} />
          <input
            type="number"
            min={0}
            max={100}
            placeholder="MIN. SCORE"
            value={minScore}
            onChange={e => {
              const next = e.target.value;
              setMinScore(next);
              load(search, sort, fieldCategory, companyFilter, next);
            }}
          />
        </label>
        <div className="company-autocomplete">
          <input
            className="company-filter-input"
            placeholder="COMPANY"
            value={companyFilter}
            maxLength={80}
            role="combobox"
            aria-expanded={showCompanySuggestions}
            aria-controls="company-autocomplete-options"
            disabled={!fieldCategory}
            onFocus={() => setShowCompanySuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowCompanySuggestions(false), 120)}
            onChange={e => {
              setCompanyFilter(e.target.value);
              setShowCompanySuggestions(true);
              load(search, sort, fieldCategory, e.target.value, minScore);
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

      {!fieldCategory ? (
        <div className="empty-state">
          <GraduationCap />
          <h3>Select a Field</h3>
          <p>Choose engineering, CS, or finance / consulting to browse matching resumes.</p>
        </div>
      ) : resumes.length === 0 ? (
        <div className="empty-state">
          <UsersIcon />
          <h3>No Resumes Found</h3>
          <p>Try a different search or filter, or upload your own resume.</p>
        </div>
      ) : (
        <div className="resume-grid">
          {resumes.map(r => (
            <button key={r.id} className="resume-card browse-card" onClick={() => navigate(`/app/resume/${r.id}`)}>
              <div className="icon-btn" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-dim)", color: "var(--accent)", border: "none" }}>
                <FileText size={24} />
              </div>
              <div className="card-body">
                <strong>{r.title || r.file_name}</strong>
                <span className="card-meta"><UsersIcon size={13} />{r.owner_display_name ?? "Anonymous"}</span>
                <span className="card-meta"><GraduationCap size={13} />{fieldCategoryLabel(r.field_category)}</span>
                <span className="card-meta"><Clock size={13} />{new Date(r.created_at).toLocaleDateString()}</span>
                <span className="resume-score-badge"><Star size={13} />{r.aggregate_score} score</span>
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
