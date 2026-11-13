export const SITE_URL = 'https://womenfacilitating.com';

const newTab = <span className="sr-only"> (opens in a new tab)</span>;

export function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Made with intention by{' '}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          Women Facilitating{newTab}
        </a>
        . © 2026.
      </p>
      <p className="site-footer__links">
        <a href="./privacy.html" target="_blank" rel="noopener">
          Privacy{newTab}
        </a>
        <span aria-hidden="true"> · </span>
        <a href="./terms.html" target="_blank" rel="noopener">
          Terms{newTab}
        </a>
      </p>
    </footer>
  );
}
