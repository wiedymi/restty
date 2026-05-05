import { Link } from "react-router";
import { ResttyPlayground } from "~/components/restty-playground";

export default function HomeRoute() {
  return (
    <main className="home-shell">
      <nav className="site-nav" aria-label="Primary">
        <Link className="site-brand" to="/">
          <span className="site-brand-mark">r</span>
          <span>restty</span>
        </Link>
        <div className="site-nav-links">
          <Link className="site-nav-link" to="/docs">
            Docs
          </Link>
          <a className="site-nav-link" href="https://github.com/wiedymi/restty">
            GitHub
          </a>
          <a className="site-nav-link" href="https://www.npmjs.com/package/restty">
            npm
          </a>
        </div>
      </nav>
      <ResttyPlayground />
    </main>
  );
}
