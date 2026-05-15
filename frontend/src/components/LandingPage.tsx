import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle, Code2, EyeOff, GitBranch, MessageSquare, Minus, Play, Plus, Share2, Shield, SlidersHorizontal, Sparkles, Star, Upload, Users } from "lucide-react";

type LandingPageProps = {
  isSignedIn: boolean;
};

const demoSlots = [
  {
    title: "Upload and edit in LaTeX",
    copy: "Show importing a .tex file, compiling the preview, and saving it for review.",
    file: "/demo1.mp4",
  },
  {
    title: "Highlight and suggest",
    copy: "Show a reviewer selecting resume lines and leaving a suggestion or issue.",
    file: "/demo2.mp4",
  },
  {
    title: "Resolve with revisions",
    copy: "Show uploading a child resume that fixes one or more review comments.",
    file: "/demo3.mp4",
  },
];

const workflow = [
  { icon: Upload, title: "Build your resume", copy: "Upload PDF or LaTeX, redact sensitive details, choose a field, and tag landed companies." },
  { icon: MessageSquare, title: "Collect review issues", copy: "Reviewers leave comments or replacement suggestions directly against highlighted resume lines." },
  { icon: GitBranch, title: "Ship a revision", copy: "Attach a new resume to its parent, link it to the comments it fixes, and keep a visible change tree." },
  { icon: CheckCircle, title: "Close the loop", copy: "Comment authors can resolve one or many fixed issues after reviewing the uploaded revision." },
];

const features = [
  { icon: Code2, label: "In-browser LaTeX editing and PDF compilation" },
  { icon: EyeOff, label: "Simple click-to-redact sensitive information" },
  { icon: Briefcase, label: "Find resumes that landed interviews at your dream companies" },
  { icon: Star, label: "Score and rank resumes to see what works" },
  { icon: SlidersHorizontal, label: "Browse and filter for company, activity, and score" },
  { icon: Shield, label: "Review others' resumes and refine your own" },
];

const companies = ["Meta", "Apple", "Amazon", "Netflix", "Google", "Microsoft", "OpenAI", "NVIDIA", "Tesla", "Uber"];

export function LandingPage({ isSignedIn }: LandingPageProps) {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link to="/" className="landing-brand">
          <Shield size={20} />
          <span>reviewmyresumeplease</span>
        </Link>
        <div className="landing-nav-actions">
          <a href="#demos">Demos</a>
          <a href="#workflow">Workflow</a>
          <Link className="secondary-button" to={isSignedIn ? "/app" : "/auth"}>
            {isSignedIn ? "Open app" : "Sign in"}
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><Sparkles size={14} /> Resume review workspace</span>
          <h1>Stop missing out</h1>
          <p>
            Upload a PDF or LaTeX resume, get targeted comments and suggestions, attach revisions to the exact issues they resolve,
            and browse examples by field, company, score and popularity.
          </p>
          <div className="landing-cta-row">
            <Link className="primary-button landing-primary" to={isSignedIn ? "/app/upload" : "/auth"}>
              {isSignedIn ? "Upload a resume" : "Start reviewing"} <ArrowRight size={16} />
            </Link>
            <a className="secondary-button" href="#demos"><Play size={15} /> View demo slots</a>
          </div>
        </div>

        <ProductSnapshot isSignedIn={isSignedIn} />
      </section>

      <section className="landing-demo-section" id="demos">
        <div className="landing-section-heading">
          <span>Demos</span> 
          <h2>Watch how the application works on real resumes.</h2>
        </div>
        <div className="landing-demo-grid">
          {demoSlots.map(slot => (
            <article className="landing-demo-card" key={slot.title}>
              <video className="landing-demo-video" controls autoPlay muted loop>
                <source src={slot.file} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <h3>{slot.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="landing-section-heading">
          <span>How it works</span>
          <h2>From raw resume to resolved review thread.</h2>
        </div>
        <div className="workflow-grid">
          {workflow.map((item, index) => {
            const Icon = item.icon;
            return ( 
              <article className="workflow-card" key={item.title}>
                <div className="workflow-index">{index + 1}</div>
                <Icon size={22} />
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-feature-band">
        <div className="landing-section-heading">
          <span>Functionality</span>
          <h2>Everything in the application, at a glance.</h2>
        </div>
        <div className="feature-grid">
          {features.map(item => {
            const Icon = item.icon;
            return (
              <div className="feature-pill" key={item.label}>
                <Icon size={17} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="landing-final">
        <div>
          <span><Users size={16} /> Built for peer review</span>
          <h2>Make every resume iteration easier to inspect, score, and improve.</h2>
        </div>
        <Link className="primary-button landing-primary" to={isSignedIn ? "/app" : "/auth"}>
          {isSignedIn ? "Go to dashboard" : "Create an account"} <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}

function ProductSnapshot({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="landing-product-shot accurate-mock-shot" aria-label="Product preview">
      <div className="mock-window-bar">
        <div className="mock-window-dots"><span /><span /><span /></div>
        <strong>Resume Review Workspace</strong>
        <div className="mock-window-actions">
          <span>PDF</span>
          <span>LaTeX</span>
        </div>
      </div>

      <div className="mock-review-toolbar">
        <div className="mock-back-button" aria-label="Back"><ArrowLeft size={14} /></div>
        <div className="mock-review-meta">
          <span className="mock-score-badge"><Star size={12} /> 90 SCORE </span>
          <strong>FAANG 2027</strong>
          <div className="mock-company-strip">
            {companies.slice(0, 2).map(company => <span key={company}><Briefcase size={9} />{company}</span>)}
          </div>
        </div>
        <div className="mock-review-actions">
          <span className="mock-zoom"><Minus size={10}/><b>110%</b><Plus size={10}/></span>
          <span><Share2 size={12} /> Share</span>
          <span>Edit LaTeX</span>
        </div>
      </div>

      <div className="mock-product-grid accurate-grid">
        <div className="mock-resume-paper accurate-resume-paper">
          <div className="mock-name">Jordan Lee</div>
          <div className="mock-contact">jordan.dev · github.com/jordanlee · linkedin.com/in/jordanlee</div>
          <div className="mock-section-title">Experience</div>
          <div className="mock-role-row">
            <strong>Backend Engineering Intern</strong>
            <span>Summer 2026</span>
          </div>
          <div className="mock-line wide" />
          <div className="mock-line medium" />
          <div className="mock-comment-highlight">
            <span>1</span>
            Reduced API latency by <strong>38%</strong> by redesigning request batching, indexes, and cache invalidation.
          </div>
          <div className="mock-section-title">Projects</div>
          <div className="mock-role-row">
            <strong>Resume Analytics Console</strong>
            <span>2026</span>
          </div>
          <div className="mock-line wide" />
          <div className="mock-line" />
          <div className="mock-redaction" />
        </div>

        <div className="mock-console accurate-console">
          <div className="mock-score-panel">
            <div>
              <span>Overall score</span>
              <strong>0</strong>
              <small>0 user ratings</small>
            </div>
            <label>
              <span>Your score <b>0</b></span>
              <input type="range" min="0" max="100" value="50" readOnly />
            </label>
            <button><Star size={12} /> Leave score</button>
          </div>

          <div className="mock-console-head accurate-issues-head">
            <div>
              <span>Issues</span>
              <strong>1 open</strong>
            </div>
            <div>
              <span>0 resolved</span>
            </div>
          </div>
          <div className="mock-tabs">
            <span>Open (1)</span>
            <span>Resolved (0)</span>
          </div>
          <div className="mock-comment accurate-comment">
            <span>1 · Maya · Page 1</span>
            <p>Lead with the latency win and trim the process details.</p>
            <div className="mock-comment-actions">
              <span>▲ 0</span>
              <span>▼ 0</span>
              <strong>Reply</strong>
              <strong>Upload fix</strong>
            </div>
          </div>
          <div className="mock-linked-fix">
            <GitBranch size={14} />
            <div>
              <strong>Revision uploaded</strong>
              <span>Fixes issue #1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
