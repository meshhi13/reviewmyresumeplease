import { ChangeEvent, FormEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckSquare, Code2, Columns2, Eye, FileText, KeyRound, LogOut, Mail, MessageSquare, RotateCcw, Save, Shield, Square, Upload, User as UserIcon, Users as UsersIcon, Wand2, X } from "lucide-react";
import { PdfDocument, loadPdfDocument } from "./pdfjs";
import { PdfPage } from "./components/PdfPage";
import { BrowsePage } from "./components/BrowsePage";
import { LandingPage } from "./components/LandingPage";
import { ProfilePage } from "./components/ProfilePage";
import { ResumeViewer } from "./components/ResumeViewer";
import { FAANG_PLUS_COMPANIES } from "./constants";
import type { Redaction, SavedResume, Comment, AppNotification } from "./types";

const API = import.meta.env.VITE_API_BASE_URL;

const STARTER_LATEX = String.raw`%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}


\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\begin{document}

\begin{center}
    \textbf{\Huge \scshape Jake Ryan} \\ \vspace{1pt}
    \small 123-456-7890 $|$ \href{mailto:x@x.com}{\underline{jake@su.edu}} $|$ 
    \href{https://linkedin.com/in/...}{\underline{linkedin.com/in/jake}} $|$
    \href{https://github.com/...}{\underline{github.com/jake}}
\end{center}


%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Southwestern University}{Georgetown, TX}
      {Bachelor of Arts in Computer Science, Minor in Business}{Aug. 2018 -- May 2021}
    \resumeSubheading
      {Blinn College}{Bryan, TX}
      {Associate's in Liberal Arts}{Aug. 2014 -- May 2018}
  \resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {Undergraduate Research Assistant}{June 2020 -- Present}
      {Texas A\&M University}{College Station, TX}
      \resumeItemListStart
        \resumeItem{Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems}
        \resumeItem{Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data}
        \resumeItem{Explored ways to visualize GitHub collaboration in a classroom setting}
      \resumeItemListEnd
      
    \resumeSubheading
      {Information Technology Support Specialist}{Sep. 2018 -- Present}
      {Southwestern University}{Georgetown, TX}
      \resumeItemListStart
        \resumeItem{Communicate with managers to set up campus computers used on campus}
        \resumeItem{Assess and troubleshoot computer problems brought by students, faculty and staff}
        \resumeItem{Maintain upkeep of computers, classroom equipment, and 200 printers across campus}
    \resumeItemListEnd

    \resumeSubheading
      {Artificial Intelligence Research Assistant}{May 2019 -- July 2019}
      {Southwestern University}{Georgetown, TX}
      \resumeItemListStart
        \resumeItem{Explored methods to generate video game dungeons based off of \emph{The Legend of Zelda}}
        \resumeItem{Developed a game in Java to test the generated dungeons}
        \resumeItem{Contributed 50K+ lines of code to an established codebase via Git}
        \resumeItem{Conducted  a human subject study to determine which video game dungeon generation technique is enjoyable}
        \resumeItem{Wrote an 8-page paper and gave multiple presentations on-campus}
        \resumeItem{Presented virtually to the World Conference on Computational Intelligence}
      \resumeItemListEnd

  \resumeSubHeadingListEnd


%-----------PROJECTS-----------
\section{Projects}
    \resumeSubHeadingListStart
      \resumeProjectHeading
          {\textbf{Gitlytics} $|$ \emph{Python, Flask, React, PostgreSQL, Docker}}{June 2020 -- Present}
          \resumeItemListStart
            \resumeItem{Developed a full-stack web application using with Flask serving a REST API with React as the frontend}
            \resumeItem{Implemented GitHub OAuth to get data from user’s repositories}
            \resumeItem{Visualized GitHub data to show collaboration}
            \resumeItem{Used Celery and Redis for asynchronous tasks}
          \resumeItemListEnd
      \resumeProjectHeading
          {\textbf{Simple Paintball} $|$ \emph{Spigot API, Java, Maven, TravisCI, Git}}{May 2018 -- May 2020}
          \resumeItemListStart
            \resumeItem{Developed a Minecraft server plugin to entertain kids during free time for a previous job}
            \resumeItem{Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review}
            \resumeItem{Implemented continuous delivery using TravisCI to build the plugin upon new a release}
            \resumeItem{Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin}
          \resumeItemListEnd
    \resumeSubHeadingListEnd



%
%-----------PROGRAMMING SKILLS-----------
\section{Technical Skills}
  \begin{itemize}[leftmargin=0.15in, label={}]
      \small{\item{
      \textbf{Languages}{: Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R} \\
      \textbf{Frameworks}{: React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI} \\
      \textbf{Developer Tools}{: Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse} \\
      \textbf{Libraries}{: pandas, NumPy, Matplotlib}
      }}
  \end{itemize}
  
%-------------------------------------------
\end{document}
`;

type User = { id: number; email: string; display_name: string };
type AuthResponse = { user: User; token: string };
type AuthMode = "sign-in" | "create-account" | "forgot-password" | "reset-password";
type AuthPopup = { kind: "error" | "success"; message: string };
type EditorViewMode = "source" | "split" | "preview";



function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); const [displayName, setDisplayName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [latexSource, setLatexSource] = useState(STARTER_LATEX);
  const [editingResumeId, setEditingResumeId] = useState<number | null>(null);
  const [compileError, setCompileError] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [scale, setScale] = useState(1.25);
  const [status, setStatus] = useState("Sign in to upload and save resumes.");
  const [authPopup, setAuthPopup] = useState<AuthPopup | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [anonymizeResume, setAnonymizeResume] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [landedCompanies, setLandedCompanies] = useState<string[]>([]);
  const [customCompany, setCustomCompany] = useState("");
  const [selectedResolveCommentIds, setSelectedResolveCommentIds] = useState<number[]>([]);
  const [parentResumeId, setParentResumeId] = useState<number | null>(null);
  const [ownComments, setOwnComments] = useState<(Comment & { resumeTitle: string })[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>("split");
  const hydratedParentResumeIdRef = useRef<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const pageNumbers = useMemo(() => pdf ? Array.from({ length: pdf.numPages }, (_, i) => i + 1) : [], [pdf]);

  function authHeaders(): HeadersInit { return authToken ? { Authorization: `Bearer ${authToken}` } : {}; }

  useEffect(() => {
    const token = localStorage.getItem("token");
    const isAuthRoute = location.pathname.startsWith("/auth");
    const isLandingRoute = location.pathname === "/" || location.pathname === "/landing";
    if (token) {
      setAuthToken(token);
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((u: User) => { setUser(u); setStatus("Welcome back."); })
        .catch(() => { localStorage.removeItem("token"); if (!isAuthRoute) navigate("/"); });
    } else if (!isAuthRoute && !isLandingRoute) {
      navigate("/");
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/auth") return;
    const params = new URLSearchParams(location.search);
    const token = params.get("reset_token");
    if (!token) return;
    setResetToken(token);
    setAuthMode("reset-password");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setStatus("Choose a new password.");
    setAuthPopup(null);
    navigate("/auth", { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => { if (user && authToken) loadSavedResumes(user.id); }, [user, authToken]);

  useEffect(() => {
    if (!user || !authToken) return;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [user, authToken, location.pathname]);

  useEffect(() => {
    const state = location.state as { resolvesCommentId?: number } | null;
    if (location.pathname === "/app/upload" && state?.resolvesCommentId) {
      setSelectedResolveCommentIds([state.resolvesCommentId]);
      navigate(location.pathname, { replace: true });
    }
    if (location.pathname === "/app/upload") {
      const params = new URLSearchParams(location.search);
      const editId = params.get("edit");
      if (editId && authToken) {
        fetch(`${API}/resumes/${editId}`, { headers: authHeaders() })
          .then(r => r.ok ? r.json() : Promise.reject())
          .then((resume: SavedResume) => {
            setEditingResumeId(resume.id);
            setLatexSource(resume.latex_source || STARTER_LATEX);
            setRedactions(resume.redactions || []);
            setResumeTitle(resume.title || resume.file_name.replace(/\.pdf$/i, ""));
            setLandedCompanies(resume.landed_companies || []);
            setFileName(resume.file_name);
            setStatus("Editing LaTeX source.");
          })
          .catch(() => setStatus("Could not load that resume source."));
      } else {
        setEditingResumeId(null);
      }
    }
  }, [location.pathname, location.search, location.state, authToken, navigate]);

  // Load all open comments on the user's own resumes (for the "resolves" picker)
  useEffect(() => {
    if (!savedResumes.length || !authToken) { setOwnComments([]); return; }
    Promise.all(
      savedResumes.map(async r => {
        const res = await fetch(`${API}/resumes/${r.id}/comments`, { headers: authHeaders() });
        if (!res.ok) return [];
        const comments: Comment[] = await res.json();
        return comments
          .filter(c => c.status === "open" && !c.resolved_by_resume_id)
          .map(c => ({ ...c, resumeTitle: r.title || r.file_name }));
      })
    ).then(all => setOwnComments(all.flat()));
  }, [savedResumes, authToken]);

  async function loadSavedResumes(userId: number) {
    const res = await fetch(`${API}/users/${userId}/resumes`, { headers: authHeaders() });
    if (res.ok) setSavedResumes(await res.json());
  }

  async function loadNotifications() {
    const res = await fetch(`${API}/notifications`, { headers: authHeaders() });
    if (!res.ok) return;
    const next: AppNotification[] = await res.json();
    setNotifications(current => {
      const currentIds = new Set(current.map(n => n.id));
      const freshUnread = next.find(n => !n.read && !currentIds.has(n.id));
      if (freshUnread) {
        setToast(freshUnread);
        window.setTimeout(() => setToast(t => t?.id === freshUnread.id ? null : t), 5000);
      }
      return next;
    });
  }

  function toAppPath(targetUrl: string) {
    if (!targetUrl) return "/app";
    if (targetUrl.startsWith("/app")) return targetUrl;
    if (targetUrl === "/" || targetUrl.startsWith("/auth")) return targetUrl;
    if (targetUrl.startsWith("/")) return `/app${targetUrl}`;
    return `/app/${targetUrl}`;
  }

  async function openNotification(notification: AppNotification) {
    await fetch(`${API}/notifications/${notification.id}/read`, { method: "PATCH", headers: authHeaders() });
    setNotifications(current => current.map(n => n.id === notification.id ? { ...n, read: true } : n));
    setShowNotifications(false);
    navigate(toAppPath(notification.target_url));
  }

  async function handleSignIn(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthPopup(null);
    if (authMode === "forgot-password") {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { showAuthError(payload?.detail ?? "Could not start password reset."); return; }
      setPassword(""); setConfirmPassword("");
      showAuthSuccess(payload?.message ?? "If that account exists, a reset link has been sent.");
      return;
    }
    if (authMode === "reset-password") {
      if (password !== confirmPassword) { showAuthError("Passwords do not match."); return; }
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_token: resetToken, password }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { showAuthError(payload?.detail ?? "Could not reset password."); return; }
      const auth = payload as AuthResponse;
      setUser(auth.user); setAuthToken(auth.token); localStorage.setItem("token", auth.token);
      setPassword(""); setConfirmPassword(""); setResetToken(""); navigate("/app");
      return;
    }
    if (authMode === "create-account" && password !== confirmPassword) { showAuthError("Passwords do not match."); return; }
    if (authMode === "create-account" && /\s/.test(displayName)) { showAuthError("Username cannot contain spaces."); return; }
    const endpoint = authMode === "sign-in" ? "sign-in" : "create-account";
    const body = authMode === "sign-in" ? { email, password } : { email, password, display_name: displayName };
    const res = await fetch(`${API}/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json().catch(() => null); showAuthError(err?.detail ?? "Could not sign in."); return; }
    const auth = (await res.json()) as AuthResponse;
    setUser(auth.user); setAuthToken(auth.token); localStorage.setItem("token", auth.token);
    setConfirmPassword(""); navigate("/app");
  }

  function showAuthError(detail: unknown) {
    const message = formatApiError(detail);
    setAuthPopup({ kind: "error", message });
    setStatus(message);
  }

  function showAuthSuccess(message: string) {
    setAuthPopup({ kind: "success", message });
    setStatus(message);
  }

  function formatApiError(detail: unknown) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item: any) => item?.msg || item?.message || String(item)).join(" ");
    }
    return "Something went wrong. Please try again.";
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.toLowerCase().endsWith(".tex")) { setStatus("Please upload a .tex file."); return; }
    setStatus("Reading LaTeX source…");
    const source = await file.text();
    setLatexSource(source);
    setFileName(file.name); setResumeFile(file); setEditingResumeId(null); setRedactions([]); setNotes(""); setLandedCompanies([]); setCustomCompany("");
    setStatus("LaTeX source loaded. Compile it to preview.");
  }

  async function compileLatex(source = latexSource) {
    setIsCompiling(true);
    setCompileError("");
    const res = await fetch(`${API}/latex/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ latex_source: source }),
    });
    setIsCompiling(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setCompileError(err?.detail ?? "Could not compile LaTeX.");
      setPdf(null);
      return false;
    }
    const data = await res.arrayBuffer();
    setPdf(await loadPdfDocument(data));
    setStatus("Compiled preview.");
    return true;
  }

  async function saveResume() {
    if (!user || !latexSource.trim()) { setStatus("Add LaTeX source first."); return; }
    setIsSaving(true);
    if (editingResumeId && selectedResolveCommentIds.length === 0) {
      const res = await fetch(`${API}/resumes/${editingResumeId}/latex-source`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ latex_source: latexSource, title: resumeTitle }),
      });
      setIsSaving(false);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setCompileError(err?.detail ?? "Could not save this resume.");
        setStatus("Could not save this resume.");
        return;
      }
      await loadSavedResumes(user.id);
      setStatus("Saved.");
      navigate("/app/profile");
      return;
    }

    const fd = new FormData();
    fd.append("redactions", JSON.stringify(redactions));
    fd.append("anonymized", String(anonymizeResume)); fd.append("notes", notes);
    fd.append("title", resumeTitle); fd.append("latex_source", latexSource); fd.append("landed_companies", JSON.stringify(landedCompanies));
    if (selectedResolveCommentIds.length > 0) {
      fd.append("resolves_comment_id", String(selectedResolveCommentIds[0]));
      fd.append("resolves_comment_ids", JSON.stringify(selectedResolveCommentIds));
    }
    if (parentResumeId) fd.append("parent_resume_id", String(parentResumeId));
    const res = await fetch(`${API}/users/${user.id}/resumes`, { method: "POST", headers: authHeaders(), body: fd });
    setIsSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setCompileError(err?.detail ?? "Could not save this resume.");
      setStatus("Could not save this resume.");
      return;
    }
    await loadSavedResumes(user.id); setStatus("Saved."); setSelectedResolveCommentIds([]); setParentResumeId(null); setLandedCompanies([]); setCustomCompany(""); navigate("/app/profile");
  }

  function signOut() {
    setUser(null); setAuthToken(""); localStorage.removeItem("token");
    setPassword(""); setConfirmPassword(""); setPdf(null); setResumeFile(null);
    setResetToken(""); setFileName(""); setEditingResumeId(null); setRedactions([]); setSavedResumes([]); setLandedCompanies([]); setCustomCompany(""); setParentResumeId(null); setNotifications([]); navigate("/auth");
  }

  function toggleLandedCompany(company: string) {
    setLandedCompanies(current =>
      current.includes(company) ? current.filter(c => c !== company) : [...current, company]
    );
  }

  function addCustomCompany() {
    const company = customCompany.trim().replace(/\s+/g, " ");
    if (!company) return;
    setLandedCompanies(current =>
      current.some(c => c.toLowerCase() === company.toLowerCase()) ? current : [...current, company]
    );
    setCustomCompany("");
  }

  const selectedResolveComments = useMemo(
    () => ownComments.filter(comment => selectedResolveCommentIds.includes(comment.id)),
    [ownComments, selectedResolveCommentIds]
  );
  const selectedResolveParentId = selectedResolveComments[0]?.resume_id ?? null;
  const parentResumeOptions = useMemo(
    () => savedResumes.filter(resume => resume.id !== editingResumeId),
    [savedResumes, editingResumeId]
  );

  useEffect(() => {
    if (selectedResolveParentId) setParentResumeId(selectedResolveParentId);
  }, [selectedResolveParentId]);

  useEffect(() => {
    if (location.pathname !== "/app/upload" || !authToken || !parentResumeId) {
      if (!parentResumeId) hydratedParentResumeIdRef.current = null;
      return;
    }
    if (hydratedParentResumeIdRef.current === parentResumeId) return;
    hydratedParentResumeIdRef.current = parentResumeId;
    const isFixParent = selectedResolveParentId === parentResumeId;
    setStatus(isFixParent ? "Loading the original resume for this fix…" : "Loading the selected parent resume…");
    fetch(`${API}/resumes/${parentResumeId}`, { headers: authHeaders() })
      .then(async r => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail ?? "Could not load the parent resume.");
      })
      .then(async (resume: SavedResume) => {
        const inheritedSource = resume.latex_source || STARTER_LATEX;
        setEditingResumeId(null);
        setLatexSource(inheritedSource);
        setRedactions(resume.redactions || []);
        setResumeTitle(resume.title ? `${resume.title} revision` : resume.file_name.replace(/\.pdf$/i, " revision"));
        setLandedCompanies(resume.landed_companies || []);
        setFileName(resume.file_name);
        setResumeFile(null);
        setPdf(null);
        setCompileError("");
        await compileLatex(inheritedSource);
        setStatus(isFixParent ? "Loaded the original resume source and redactions for this fix." : "Loaded the parent resume source and redactions.");
      })
      .catch((error: Error) => {
        hydratedParentResumeIdRef.current = null;
        setStatus(error.message || "Could not load the parent resume.");
      });
  }, [location.pathname, authToken, parentResumeId, selectedResolveParentId]);

  function toggleResolveComment(comment: Comment & { resumeTitle: string }) {
    setSelectedResolveCommentIds(current => {
      if (current.includes(comment.id)) return current.filter(id => id !== comment.id);
      const currentComments = ownComments.filter(item => current.includes(item.id));
      const currentParentId = currentComments[0]?.resume_id ?? null;
      if (currentParentId && currentParentId !== comment.resume_id) return [comment.id];
      return [...current, comment.id];
    });
  }

  /* ── AUTH ── */
  const authTitle =
    authMode === "create-account" ? "Create your account." :
      authMode === "forgot-password" ? "Reset your password." :
        authMode === "reset-password" ? "Choose a new password." :
          "Sign in to continue.";
  const authSubmitText =
    authMode === "create-account" ? "Create Account" :
      authMode === "forgot-password" ? "Send Reset Link" :
        authMode === "reset-password" ? "Reset Password" :
          "Sign In";
  const authView = (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={handleSignIn}>
        <div className="auth-brand">
          <div className="icon-btn" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-dim)", color: "var(--accent)", border: "none", marginBottom: 8 }}>
            <Shield size={24} />
          </div>
          <h1>reviewmyresumeplease</h1>
          <p className="auth-subtitle">{authTitle}</p>
        </div>
        <div className="auth-tabs">
          <button className={authMode === "sign-in" ? "selected" : ""} type="button" onClick={() => { setAuthPopup(null); setAuthMode("sign-in"); }}>Sign In</button>
          <button className={authMode === "create-account" ? "selected" : ""} type="button" onClick={() => { setAuthPopup(null); setAuthMode("create-account"); }}>Register</button>
        </div>
        {authPopup && (
          <div className={`auth-error-popup ${authPopup.kind}`} role={authPopup.kind === "error" ? "alert" : "status"}>
            <strong>{authPopup.kind === "error" ? "Alert" : "Email sent"}</strong>
            <span>{authPopup.message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setAuthPopup(null)}>×</button>
          </div>
        )}
        {authMode === "create-account" && (
          <label><span>Username</span>
            <input
              autoComplete="username"
              maxLength={30}
              minLength={3}
              onChange={e => setDisplayName(e.target.value.replace(/\s+/g, ""))}
              pattern="[A-Za-z0-9_-]{3,30}"
              placeholder="Ada_Lovelace"
              required
              value={displayName}
            /></label>
        )}
        {authMode === "reset-password" ? (
          <div className="auth-reset-note">
            This reset applies to the account tied to the link in your email.
          </div>
        ) : (
          <label><span>Email</span><input autoComplete="email" maxLength={100} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} /></label>
        )}
        {authMode !== "forgot-password" && (
          <label><span>{authMode === "reset-password" ? "New Password" : "Password"}</span><input autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} minLength={authMode === "sign-in" ? 8 : 12} maxLength={128} onChange={e => setPassword(e.target.value)} placeholder={authMode === "sign-in" ? "Your password" : "12+ chars, upper, lower, number, symbol"} required type="password" value={password} /></label>
        )}
        {(authMode === "create-account" || authMode === "reset-password") && (
          <label><span>Confirm Password</span><input autoComplete="new-password" minLength={12} maxLength={128} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required type="password" value={confirmPassword} /></label>
        )}
        <button className="primary-button" type="submit">{authMode === "reset-password" ? <KeyRound size={16} /> : <Mail size={16} />}{authSubmitText}</button>
        {authMode === "sign-in" && (
          <button className="text-btn auth-link" type="button" onClick={() => { setAuthPopup(null); setAuthMode("forgot-password"); setPassword(""); setConfirmPassword(""); setStatus("Enter your account email to reset your password."); }}>
            Forgot password?
          </button>
        )}
        {(authMode === "forgot-password" || authMode === "reset-password") && (
          <button className="text-btn auth-link" type="button" onClick={() => { setAuthPopup(null); setAuthMode("sign-in"); setPassword(""); setConfirmPassword(""); setResetToken(""); setStatus("Sign in to upload and save resumes."); }}>
            Back to sign in
          </button>
        )}
      </form>
    </main>
  );

  /* ── UPLOAD ── */
  const uploadView = (
    <div className="upload-layout">
      <aside className="upload-sidebar">
        <label className="upload-target"><Upload size={18} /><span>Import .tex</span><input accept=".tex,text/x-tex,text/plain" type="file" onChange={handleUpload} /></label>
        <section className="panel">
          <h2>Resume Details</h2>
          <label><span>Title (optional)</span>
            <input style={{ background: "transparent", border: "none", borderBottom: "2px solid var(--accent-dim)", color: "var(--fg)", padding: "8px 4px", width: "100%" }}
              placeholder="e.g. Software Engineer 2025" maxLength={255} value={resumeTitle} onChange={e => setResumeTitle(e.target.value)} />
          </label>
          <div className={`file-row ${fileName ? "uploaded" : "empty"}`}>
            <FileText size={16} /><span>{fileName || "Editing source directly"}</span>
          </div>
          <div className="company-picker">
            <span>Landed Interview at Company</span>
            <div className="company-chip-grid">
              {FAANG_PLUS_COMPANIES.map(company => (
                <button
                  key={company}
                  type="button"
                  className={`company-chip ${landedCompanies.includes(company) ? "selected" : ""}`}
                  onClick={() => toggleLandedCompany(company)}
                >
                  {company}
                </button>
              ))}
              {landedCompanies.filter(company => !FAANG_PLUS_COMPANIES.some(known => known.toLowerCase() === company.toLowerCase())).map(company => (
                <button
                  key={company}
                  type="button"
                  className="company-chip selected"
                  onClick={() => toggleLandedCompany(company)}
                >
                  {company}
                </button>
              ))}
            </div>
            <div className="custom-company-row">
              <input
                placeholder="Custom company"
                value={customCompany}
                maxLength={80}
                onChange={e => setCustomCompany(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomCompany(); } }}
              />
              <button type="button" className="secondary-button" onClick={addCustomCompany}>Add</button>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title-row"><h2>Preview Redactions</h2><span className="badge">{redactions.length}</span></div>
          <button className="secondary-button" onClick={() => setRedactions([])} disabled={!redactions.length}><RotateCcw size={14} /> Clear All</button>
        </section>
        <section className="panel">
          <h2>Save Options</h2>
          <textarea onChange={e => setNotes(e.target.value)} placeholder="Optional note for reviewers" value={notes} />
          {parentResumeOptions.length > 0 && (!editingResumeId || selectedResolveCommentIds.length > 0) && (
            <label>
              <span>Parent Resume (optional)</span>
              <select
                className="sort-select"
                disabled={Boolean(selectedResolveParentId)}
                style={{ width: "100%", marginTop: 4 }}
                value={parentResumeId ?? ""}
                onChange={e => setParentResumeId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No parent</option>
                {parentResumeOptions.map(resume => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title || resume.file_name}
                  </option>
                ))}
              </select>
              {selectedResolveParentId && <small className="form-note">Locked to the resume whose comments this upload fixes.</small>}
            </label>
          )}
          {ownComments.length > 0 && (
            <div className="resolve-picker">
              <div className="panel-title-row">
                <h3>Resolve comments</h3>
                <span className="badge">{selectedResolveCommentIds.length} selected</span>
              </div>
              <p>Select one or more comments from the same resume. The uploaded resume will appear as their proposed fix.</p>
              <div className="resolve-issue-list">
                {ownComments.map(c => {
                  const selected = selectedResolveCommentIds.includes(c.id);
                  const lockedToAnotherResume = Boolean(selectedResolveParentId && selectedResolveParentId !== c.resume_id && !selected);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`resolve-issue-card ${selected ? "selected" : ""}`}
                      disabled={lockedToAnotherResume}
                      onClick={() => toggleResolveComment(c)}
                    >
                      <div className="resolve-issue-head">
                        {selected ? <CheckSquare size={15} /> : <Square size={15} />}
                        <strong>{c.resumeTitle}</strong>
                        <span>Issue #{c.id} · p{c.page}</span>
                      </div>
                      <div className="resolve-issue-body">
                        <MessageSquare size={14} />
                        <span>{c.body}</span>
                      </div>
                      {c.suggestion_status !== "none" && (
                        <div className="resolve-suggestion-preview">
                          <div><Wand2 size={13} /> Suggested change</div>
                          <pre className="suggestion-original">{c.suggestion_original}</pre>
                          <pre className="suggestion-replacement">{c.suggestion_replacement}</pre>
                        </div>
                      )}
                      {lockedToAnotherResume && <small>Select comments from one resume at a time.</small>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {selectedResolveComments.length > 0 && (
            <div className="issue-fix-banner">
              Uploading this resume as a proposed fix for {selectedResolveComments.length} issue{selectedResolveComments.length === 1 ? "" : "s"} on {selectedResolveComments[0].resumeTitle}.
            </div>
          )}
          {editingResumeId && selectedResolveCommentIds.length === 0 && (
            <div className="issue-fix-banner">
              Saving changes to this existing LaTeX resume.
            </div>
          )}
          <button className="primary-button" disabled={!latexSource.trim() || isSaving} onClick={saveResume}><Save size={14} />{isSaving ? "Saving…" : editingResumeId && selectedResolveCommentIds.length === 0 ? "Save Changes" : "Save for Review"}</button>
        </section>
      </aside>
      <section className="workspace">
        <header className="toolbar">
          <div><strong>{pdf ? `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}` : "LaTeX Resume Editor"}</strong><span>Edit source, compile, then review the generated PDF preview</span></div>
          <div className="toolbar-actions">
            <div className="editor-view-toggle" aria-label="Editor view">
              <button className={editorViewMode === "source" ? "selected" : ""} onClick={() => setEditorViewMode("source")} title="Show source only"><Code2 size={14} /></button>
              <button className={editorViewMode === "split" ? "selected" : ""} onClick={() => setEditorViewMode("split")} title="Show source and preview"><Columns2 size={14} /></button>
              <button className={editorViewMode === "preview" ? "selected" : ""} onClick={() => setEditorViewMode("preview")} title="Show preview only"><Eye size={14} /></button>
            </div>
            <button className="primary-button compile-toolbar-button" disabled={!latexSource.trim() || isCompiling} onClick={() => compileLatex()}>
              <FileText size={14} />{isCompiling ? "Compiling…" : "Compile"}
            </button>
            {editorViewMode !== "source" && (
              <div className="zoom-control">
                <button onClick={() => setScale(v => Math.max(0.75, v - 0.15))}>−</button>
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(v => Math.min(2, v + 0.15))}>+</button>
              </div>
            )}
          </div>
        </header>
        <div className={`latex-workspace ${editorViewMode}`}>
          {editorViewMode !== "preview" && (
            <div className="latex-editor-pane">
              <textarea
                className="latex-source-editor"
                value={latexSource}
                spellCheck={false}
                onChange={e => setLatexSource(e.target.value)}
              />
              {compileError && <pre className="latex-error">{compileError}</pre>}
            </div>
          )}
          {editorViewMode !== "source" && (
            <div className="document-stage latex-preview-pane">
              {!pdf ? (
                <div className="empty-state"><FileText /><h3>Compile a Preview</h3><p>Your generated resume PDF will appear here for redactions and review.</p></div>
              ) : (
                <div className="pages">{pageNumbers.map(n => (
                  <PdfPage key={n} pdf={pdf} pageNumber={n} scale={scale}
                    redactions={redactions.filter(r => r.page === n)}
                    addRedaction={r => { if (r.width >= 4 && r.height >= 4) setRedactions(c => [...c, { ...r, id: crypto.randomUUID() }]); }}
                    removeRedaction={id => setRedactions(c => c.filter(r => r.id !== id))} />
                ))}</div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  if (!user && location.pathname.startsWith("/app")) return null;

  return (
    <Routes>
      <Route path="/" element={<LandingPage isSignedIn={Boolean(user)} />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/auth" element={authView} />
      <Route path="/app/*" element={
        <div className="app-shell">
          <header className="top-nav">
            <Link to="/app" className="nav-brand"><Shield size={18} /><span>reviewmyresumeplease</span></Link>
            <nav className="nav-links">
              <Link to="/app" className={location.pathname === "/app" ? "active" : ""}><UsersIcon size={16} /> Browse</Link>
              <Link to="/app/profile" className={location.pathname.startsWith("/app/profile") ? "active" : ""}><UserIcon size={16} /> Profile</Link>
              <Link to="/app/upload" className={location.pathname.startsWith("/app/upload") ? "active" : ""}><Upload size={16} /> Upload</Link>
            </nav>
            <div className="nav-user">
              <div className="notification-center">
                <button className="icon-btn" onClick={() => setShowNotifications(v => !v)} title="Notifications" style={{ width: 32, height: 32 }}>
                  <Bell size={14} />
                  {notifications.some(n => !n.read) && <span className="notification-dot">{notifications.filter(n => !n.read).length}</span>}
                </button>
                {showNotifications && (
                  <div className="notification-menu">
                    <div className="notification-menu-header">Notifications</div>
                    {notifications.length === 0 ? (
                      <p className="notification-empty">Nothing new yet.</p>
                    ) : (
                      notifications.map(notification => (
                        <button
                          key={notification.id}
                          className={`notification-item ${notification.read ? "read" : "unread"}`}
                          onClick={() => openNotification(notification)}
                        >
                          <span>{notification.message}</span>
                          <small>{new Date(notification.created_at).toLocaleString()}</small>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="user-avatar">{user?.display_name?.charAt(0)?.toUpperCase() ?? "?"}</div>
              <span className="user-name">{user?.display_name}</span>
              <button className="icon-btn" onClick={signOut} title="Sign Out" style={{ marginLeft: 8, width: 32, height: 32 }}><LogOut size={14} /></button>
            </div>
          </header>
          <main className="main-content">
            {toast && (
              <button className="notification-toast" onClick={() => openNotification(toast)}>
                <span>{toast.message}</span>
                <X size={14} onClick={e => { e.stopPropagation(); setToast(null); }} />
              </button>
            )}
            <Routes>
              <Route index element={<BrowsePage token={authToken} apiBase={API} />} />
              <Route path="profile" element={<ProfilePage user={user} savedResumes={savedResumes} setSavedResumes={setSavedResumes} token={authToken} apiBase={API} onSignOut={signOut} />} />
              <Route path="upload" element={uploadView} />
              <Route path="resume/:id" element={<ResumeViewer currentUserId={user?.id ?? null} token={authToken} apiBase={API} />} />
            </Routes>
          </main>
        </div>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
