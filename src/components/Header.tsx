export function Logo() {
  return (
    <svg className="logo" viewBox="106 103 868 868" aria-hidden="true" focusable="false">
      <circle cx="540" cy="537" r="434" fill="#252a5c" />
      <path d="M242 330H403L417 435L439 330H567L590 432L604 330H757L674 625H518L496 521L474 625H325Z" fill="#fbd36b" />
      <path d="M556 496H830V608H702V621H818V729H702V778H556Z" fill="#e875c2" />
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
