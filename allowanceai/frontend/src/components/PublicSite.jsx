import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import BudgetCards from "./BudgetCards";
import InstallButton from "./InstallButton";
const features = [
  [
    "01",
    "A plan for every rand",
    "Set your monthly allowance, savings target and category limits. Give everyday spending a clear place in your plan.",
  ],
  [
    "02",
    "Know where it goes",
    "Record expenses, review your history and adjust entries as your month unfolds.",
  ],
  [
    "03",
    "Shop with perspective",
    "Check a purchase against your budget. Evaluate and save shopping lists before you spend.",
  ],
  [
    "04",
    "See the bigger picture",
    "Explore monthly reports, charts, spending patterns and rule-based recommendations.",
  ],
  [
    "05",
    "Keep savings in sight",
    "Include a savings target and savings categories in your monthly budget.",
  ],
  [
    "06",
    "Your workspace, organized",
    "Review budget alerts and in-app notifications. Manage your profile and export your account data.",
  ],
];
const steps = [
  [
    "Create your account",
    "Register with your name, email and password to open your personal workspace.",
  ],
  [
    "Organize your finances",
    "Review the starter budget, set your own allowance and savings target, and organize categories.",
  ],
  [
    "Track your progress",
    "Record purchases and review spending, remaining budget and monthly reports.",
  ],
  [
    "Make informed decisions",
    "Use summaries and rule-based guidance to consider your next purchase.",
  ],
];
const faqs = [
  [
    "What is AllowanceAI?",
    "A personal budgeting platform for planning a monthly allowance, recording expenses and understanding your spending.",
  ],
  [
    "Who is it for?",
    "People who want a clearer view of their everyday budget, including students and anyone managing a monthly allowance.",
  ],
  [
    "How do I create an account?",
    "Choose Get Started and register with your name, email and a password of at least six characters. Review the starter amounts and replace them with your own budget.",
  ],
  [
    "Can I use it on my phone?",
    "Yes. Use the responsive website, or install it through a supported browser. Financial records and updates require an internet connection.",
  ],
  [
    "How does budgeting work?",
    "Set an allowance and savings target, allocate categories, then enter expenses. The dashboard summarizes spending and remaining funds.",
  ],
  [
    "Is my information private?",
    "Financial endpoints require an account and enforce user ownership. Administrators can access account lists and system statistics. See the privacy information for implementation details and current policy limitations.",
  ],
  [
    "What if I forget my password?",
    "Self-service password recovery is not currently available. Signed-in users can change their password in Profile. For assistance, use the developer contact options linked below; never share your password.",
  ],
  [
    "How do I contact support?",
    "Visit Matsoso Phomolo’s portfolio using the contact link below. A dedicated in-app support inbox is not currently available.",
  ],
];
export default function PublicSite({ user, onLogout }) {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    document.title = `${pathname === "/" ? "Take control of your money" : pathname.slice(1).replaceAll("-", " ")} | AllowanceAI`;
  }, [pathname]);
  const known = [
    "/",
    "/features",
    "/how-it-works",
    "/about",
    "/help",
    "/privacy",
    "/terms",
  ].includes(pathname);
  const home = pathname === "/";
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            a<span>i</span>
          </span>
          AllowanceAI
        </Link>
        <button
          className="menu-toggle secondary-button"
          aria-expanded={menu}
          aria-controls="public-navigation"
          onClick={() => setMenu(!menu)}
        >
          Menu
        </button>
        <nav
          id="public-navigation"
          className={menu ? "public-nav open" : "public-nav"}
          aria-label="Main navigation"
        >
          {[
            ["/", "Home"],
            ["/features", "Features"],
            ["/how-it-works", "How it works"],
            ["/about", "About"],
            ["/help", "Help"],
          ].map(([to, label]) => (
            <NavLink end key={to} to={to}>
              {label}
            </NavLink>
          ))}
          {user ? (
            <>
              <Link className="button-link" to="/app">
                Dashboard →
              </Link>
              <details className="account-menu">
                <summary>Account</summary>
                <Link to="/app/profile">Profile & settings</Link>
                <button type="button" onClick={onLogout}>
                  Log out
                </button>
              </details>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link className="button-link" to="/register">
                Get Started →
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main-content">
        {!home && known && !["/terms"].includes(pathname) && (
          <h1 className="public-page-title public-container">
            {
              {
                "/features": "Tools for a clearer month",
                "/how-it-works": "How AllowanceAI works",
                "/about": "About AllowanceAI",
                "/help": "Help & support",
                "/privacy": "Privacy information",
              }[pathname]
            }
          </h1>
        )}
        {home && (
          <>
            <section className="hero public-container">
              <div>
                <p className="eyebrow">
                  <span className="status-dot" /> A little clarity. A better
                  month.
                </p>
                <h1>
                  Take control
                  <br />
                  of your <em>money.</em>
                </h1>
                <p className="hero-copy">
                  Plan your budget, understand your spending and keep your
                  savings in sight. One simple workspace for your everyday
                  financial life.
                </p>
                <div className="cta-row">
                  <Link
                    className="button-link"
                    to={user ? "/app" : "/register"}
                  >
                    {user ? "Open dashboard" : "Get Started"}{" "}
                    <span aria-hidden="true">↗</span>
                  </Link>
                  <Link className="text-link" to="/features">
                    Explore features →
                  </Link>
                </div>
                <p className="small-note">
                  Built for real life. Designed around your monthly budget.
                </p>
              </div>
              <div className="preview-frame">
                <div className="preview-top">
                  <span className="brand">AllowanceAI</span>
                  <span className="sample-badge">Demonstration data</span>
                </div>
                <p className="eyebrow">Your month, at a glance</p>
                <h2>A clearer picture.</h2>
                <BudgetCards
                  budget={{
                    allowance: 3000,
                    total_spent: 1240,
                    remaining_money: 1760,
                    savings_target: 400,
                  }}
                />
                <div className="preview-categories">
                  {[
                    ["Food", 64, "R640 / R1,000"],
                    ["Transport", 55, "R440 / R800"],
                    ["Everyday essentials", 40, "R160 / R400"],
                  ].map(([label, value, amount]) => (
                    <div key={label}>
                      <div>
                        <strong>{label}</strong>
                        <span>{amount}</span>
                      </div>
                      <progress
                        aria-label={`${label} budget used`}
                        value={value}
                        max="100"
                      />
                    </div>
                  ))}
                </div>
                <p className="small-note">
                  Illustrative budget · Actual summary card component
                  <br />
                  Your account displays your own financial records.
                </p>
              </div>
            </section>
            <div className="value-strip">
              <span>Plan with intention</span>
              <span>Track everyday spending</span>
              <span>Build better habits</span>
            </div>
          </>
        )}
        {(home || pathname === "/features") && (
          <section className="public-container section-space">
            <p className="eyebrow">A place for the whole month</p>
            <h2>
              Less guesswork.
              <br />
              More understanding.
            </h2>
            <p className="section-intro">
              Bring your budget, expenses and purchase decisions together. Start
              with what you have and see what’s possible.
            </p>
            <div className="feature-grid">
              {features.map(([n, title, copy]) => (
                <article className="feature-card" key={n}>
                  <span className="feature-number">{n} /</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <p className="small-note">
              Insights use budgeting rules, not an external generative AI model.
              AllowanceAI does not connect to banks or move money.
            </p>
          </section>
        )}
        {(home || pathname === "/how-it-works") && (
          <section className="steps-section">
            <div className="public-container section-space">
              <p className="eyebrow">Small steps, lasting clarity</p>
              <h2>Your next month starts here.</h2>
              <div className="steps-grid">
                {steps.map(([title, copy], i) => (
                  <article key={title}>
                    <span className="step-number">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
              <Link className="button-link" to="/register">
                Create your account →
              </Link>
            </div>
          </section>
        )}
        {(home || pathname === "/about") && (
          <section className="public-container section-space about-section">
            <div>
              <p className="eyebrow">Independent by design</p>
              <h2>
                Personal finance.
                <br />A personal commitment.
              </h2>
            </div>
            <div>
              <p>
                AllowanceAI is an independent software product founded,
                developed and owned by{" "}
                <a href="https://matsoso.dev/">Matsoso Phomolo</a>. It helps
                people make sense of their monthly finances through practical
                planning tools.
              </p>
              <p>
                It is publicly available through account registration. Users
                retain their rights in their own financial information. The
                proprietary software and product identity belong to Matsoso
                Phomolo.
              </p>
              <Link className="text-link" to="/help">
                Get to know the platform →
              </Link>
            </div>
          </section>
        )}
        {(home || pathname === "/help") && (
          <section className="public-container section-space">
            <p className="eyebrow">Good to know</p>
            <h2>A little help getting started.</h2>
            <div className="faq-list">
              {faqs.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            {pathname === "/help" && (
              <div className="help-install">
                <h3>Take your budget with you</h3>
                <p>
                  On iPhone or iPad, open in Safari, then choose Share → Add to
                  Home Screen. In supported Chrome or Edge browsers, use the
                  install button or browser menu. Installation availability
                  depends on your browser.
                </p>
                <InstallButton />
                <p>
                  Installed apps launch the public homepage. Open Dashboard to
                  access your workspace. Offline access is limited to cached
                  pages; financial operations need connectivity.
                </p>
                <a className="text-link" href="https://matsoso.dev/">
                  Developer contact options ↗
                </a>
              </div>
            )}
          </section>
        )}
        {(home || pathname === "/privacy") && (
          <section className="trust-section public-container section-space">
            <p className="eyebrow">Your information matters</p>
            <h2>A workspace with account controls.</h2>
            <p>
              Passwords are stored as salted hashes. Financial API requests
              require an authenticated account and use ownership checks. Your
              existing session is stored in this browser; log out when using a
              shared device.
            </p>
            <p>
              Profile settings let you export your account data, update your
              password and delete your account. Administrators have access to
              account lists and system statistics.
            </p>
            {pathname === "/privacy" && (
              <>
                <h3>Privacy information and policy status</h3>
                <p>
                  This is an implementation-based summary, not an approved
                  privacy policy. The platform stores account details and
                  financial entries you provide in PostgreSQL, with its frontend
                  hosted on Vercel and backend on Render. Browser storage holds
                  your sign-in token; the service worker caches public
                  application resources, not cross-origin financial API
                  responses.
                </p>
                <p>
                  A formal policy covering retention, backups, provider
                  processing, jurisdiction and privacy contact procedures has
                  not yet been supplied. Contact the developer for clarification
                  before submitting sensitive information. No certification,
                  external audit or bank-grade security claim is made.
                </p>
              </>
            )}
            <div className="cta-row">
              <Link to="/privacy">Privacy information</Link>
              <Link to="/terms">Terms information</Link>
              <Link to="/app/profile">Account and data controls</Link>
            </div>
          </section>
        )}
        {pathname === "/terms" && (
          <section className="public-container section-space legal-copy">
            <p className="eyebrow">Product and use information</p>
            <h1>Terms information</h1>
            <p>
              AllowanceAI is independently owned by Matsoso Phomolo. Its
              software, source code and product identity remain proprietary.
              Users retain their rights in their own personal and financial
              information.
            </p>
            <p>
              Registration provides access to the platform’s supported financial
              planning tools. Summaries and rule-based recommendations depend on
              the information entered and do not perform banking transactions.
            </p>
            <h2>Formal terms pending</h2>
            <p>
              No approved Terms of Service were present in the repository or
              provided for this release. This page does not invent a license,
              acceptance agreement, liability waiver or binding legal
              commitments. Formal terms require owner review and publication.
            </p>
            <a href="https://matsoso.dev/">
              Contact the developer for clarification ↗
            </a>
          </section>
        )}
        {!known && (
          <section className="public-container section-space">
            <h1>Page not found</h1>
            <p>This address does not match a public page.</p>
            <Link className="button-link" to="/">
              Return home
            </Link>
          </section>
        )}
        {home && (
          <section className="closing-cta public-container">
            <p className="eyebrow">Make room for what matters</p>
            <h2>Your money. Your month. Your plan.</h2>
            <Link className="button-link" to={user ? "/app" : "/register"}>
              {user ? "Open dashboard" : "Start your plan"} →
            </Link>
          </section>
        )}
      </main>
      <footer className="public-footer public-container">
        <div>
          <Link className="brand" to="/">
            AllowanceAI
          </Link>
          <p>Everyday finances, with a clearer direction.</p>
          <p>
            Independently developed by{" "}
            <a href="https://matsoso.dev/">Matsoso Phomolo</a>.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/features">Features</Link>
          <Link to="/help">Help & installation</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href="https://matsoso.dev/">Contact</a>
        </nav>
        <p className="copyright">© AllowanceAI. All rights reserved.</p>
      </footer>
    </div>
  );
}
