import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CheckCircle, Code2, EyeOff, FileText, GitBranch, MessageSquare, Play, Share2, Shield, SlidersHorizontal, Sparkles, Star, Upload, Users } from "lucide-react";

type LandingPageProps = {
  isSignedIn: boolean;
};

const demoSlots = [
  {
    title: "Upload and edit in LaTeX",
    copy: "Show importing a .tex file, compiling the preview, and saving it for review.",
    file: "public/demos/upload-latex.gif",
  },
  {
    title: "Highlight and suggest",
    copy: "Show a reviewer selecting resume lines and leaving a suggestion or issue.",
    file: "public/demos/suggest-change.gif",
  },
  {
    title: "Resolve with revisions",
    copy: "Show uploading a child resume that fixes one or more review comments.",
    file: "public/demos/resolve-tree.gif",
  },
];

const workflow = [
  { icon: Upload, title: "Build your resume", copy: "Upload LaTeX, compile a PDF preview, redact sensitive details, and tag landed companies." },
  { icon: MessageSquare, title: "Collect review issues", copy: "Reviewers leave comments or replacement suggestions directly against highlighted resume lines." },
  { icon: GitBranch, title: "Ship a revision", copy: "Attach a new resume to its parent, link it to the comments it fixes, and keep a visible change tree." },
  { icon: CheckCircle, title: "Close the loop", copy: "Comment authors can resolve one or many fixed issues after reviewing the uploaded revision." },
];

const features = [
  { icon: Code2, label: "In-browser LaTeX editing and PDF compilation" },
  { icon: EyeOff, label: "Redactions that protect the visible resume and source" },
  { icon: Briefcase, label: "FAANG+ and custom company tags" },
  { icon: Star, label: "Independent user scores with browse filtering" },
  { icon: SlidersHorizontal, label: "Browse filters for company, activity, downvotes, and score" },
  { icon: Shield, label: "Password reset, rate limits, and safer auth flows" },
];

export function LandingPage({ isSignedIn }: LandingPageProps) {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link to={isSignedIn ? "/" : "/landing"} className="landing-brand">
          <Shield size={20} />
          <span>reviewmyresumeplease</span>
        </Link>
        <div className="landing-nav-actions">
          <a href="#demos">Demos</a>
          <a href="#workflow">Workflow</a>
          <Link className="secondary-button" to={isSignedIn ? "/" : "/auth"}>
            {isSignedIn ? "Open app" : "Sign in"}
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1>Stop missing out</h1>
          <p>
            Upload a LaTeX resume, get targeted comments and suggestions, attach revisions to the exact issues they resolve,
            and browse examples by company, score and popularity.
          </p>
          <div className="landing-cta-row">
            <Link className="primary-button landing-primary" to={isSignedIn ? "/upload" : "/auth"}>
              {isSignedIn ? "Upload a resume" : "Start reviewing"} <ArrowRight size={16} />
            </Link>
            <a className="secondary-button" href="#demos"><Play size={15} /> View demo slots</a>
          </div>
        </div>

        <div className="landing-product-shot" aria-label="Product preview">
          <div className="mock-window-bar">
            <div className="mock-window-dots"><span /><span /><span /></div>
            <strong>Resume Review Workspace</strong>
            <div className="mock-window-actions">
              <span>PDF</span>
              <span>LaTeX</span>
            </div>
          </div>
          <div className="mock-toolbar">
            <button><Upload size={13} /> Import .tex</button>
            <button><EyeOff size={13} /> Redact</button>
            <button><Star size={13} /> Score 86</button>
            <button><Share2 size={13} /> Share</button>
          </div>
          <div className="mock-product-grid">
            <div className="mock-resume-stage">
              <div className="mock-page-label">Page 1</div>
              <div className="mock-resume-paper">
                <div className="mock-name">Avery Chen</div>
                <div className="mock-contact">avery.dev · github.com/avery · linkedin.com/in/avery</div>
                <div className="mock-section-title">Experience</div>
                <div className="mock-role-row">
                  <strong>Software Engineer Intern</strong>
                  <span>Summer 2025</span>
                </div>
                <div className="mock-line wide" />
                <div className="mock-line" />
                <div className="mock-highlight">
                  <span>Suggested replacement</span>
                  <strong>AI Engineer Intern</strong>
                </div>
                <div className="mock-section-title">Projects</div>
                <div className="mock-line wide" />
                <div className="mock-line medium" />
                <div className="mock-redaction" />
              </div>
            </div>
            <div className="mock-console">
              <div className="mock-console-head">
                <div>
                  <span>Issues</span>
                  <strong>3 open</strong>
                </div>
                <div className="mock-score"><Star size={14} /> 86</div>
              </div>
              <div className="mock-score-control">
                <span>Your score</span>
                <input type="range" min="0" max="100" value="86" readOnly />
              </div>
              <div className="mock-comment">
                <span>Issue #14 · Page 1</span>
                <p>Rename this role to better match the ML-heavy bullets.</p>
              </div>
              <div className="mock-suggestion">
                <span>Suggested change</span>
                <del>Software Engineer Intern</del>
                <ins>AI Engineer Intern</ins>
              </div>
              <div className="mock-linked-fix">
                <GitBranch size={14} />
                <div>
                  <strong>Revision uploaded</strong>
                  <span>Fixes issues #14, #16</span>
                </div>
              </div>
              <div className="mock-tags">
                <span>Meta</span>
                <span>OpenAI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-demo-section" id="demos">
        <div className="landing-section-heading">
          <span>GIF demo library</span>
          <h2>Drop your product recordings into these slots.</h2>
          <p>Use the suggested filenames or swap the placeholders with uploaded GIFs when you have the clips ready.</p>
        </div>
        <div className="landing-demo-grid">
          {demoSlots.map(slot => (
            <article className="landing-demo-card" key={slot.title}>
              <div className="landing-gif-slot">
                <Play size={30} />
                <strong>GIF demo slot</strong>
                <span>{slot.file}</span>
              </div>
              <h3>{slot.title}</h3>
              <p>{slot.copy}</p>
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
        <Link className="primary-button landing-primary" to={isSignedIn ? "/" : "/auth"}>
          {isSignedIn ? "Go to dashboard" : "Create an account"} <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
