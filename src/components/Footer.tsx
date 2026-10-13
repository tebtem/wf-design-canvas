export const SITE_URL = 'https://womenfacilitating.com';

export function Footer() {
  return (
    <footer className="site-footer">
      <p>
        This tool was developed by{' '}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          Women Facilitating<span className="sr-only"> (opens in a new tab)</span>
        </a>
        . © 2026.
      </p>
    </footer>
  );
}
