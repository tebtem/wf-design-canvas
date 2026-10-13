export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="50" fill="#232A5C" />
      <path d="M14 30h13l5 22 6-22h10l6 22 5-22h13l-12 40H55l-6-20-6 20H27z" fill="#F9CF4A" />
      <path d="M58 46h28v10H70v6h14v9H70v14H58z" fill="#E86FC4" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="canvas-header">
      <h1 className="title">
        <span className="title__big">Designing</span>
        <span className="title__small">Facilitated Experiences</span>
      </h1>
      <div className="canvas-header__right">
        <p className="canvas-name">Facilitation Design Canvas</p>
        <Logo />
      </div>
    </header>
  );
}
