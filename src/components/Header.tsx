import { useCanvas } from '../state/CanvasContext';
import { DETAIL_FIELDS } from '../state/types';
import { SITE_URL } from './Footer';
import wordmark from '../assets/designing-facilitated-experiences.png';

export function Logo() {
  return (
    <svg className="logo" viewBox="106 103 868 868" aria-hidden="true" focusable="false">
      <circle cx="540" cy="537" r="434" fill="#252a5c" />
      <path d="M242 330H403L417 435L439 330H567L590 432L604 330H757L674 625H518L496 521L474 625H325Z" fill="#fbd36b" />
      <path d="M556 496H830V608H702V621H818V729H702V778H556Z" fill="#e875c2" />
    </svg>
  );
}

export function Header({ asHeading = true }: { asHeading?: boolean }) {
  const Title = asHeading ? 'h1' : 'div';
  const { state, dispatch, readOnly } = useCanvas();
  return (
    <header className="canvas-header">
      <Title className="title">
        <img
          className="title__img"
          src={wordmark}
          alt="Designing Facilitated Experiences"
          width={1886}
          height={368}
        />
      </Title>
      <div className="canvas-header__right">
        <p className="canvas-name">Facilitation Design Canvas</p>
        <a className="logo-link" href={SITE_URL} target="_blank" rel="noopener noreferrer">
          <Logo />
          <span className="sr-only">Women Facilitating website (opens in a new tab)</span>
        </a>
      </div>
      <div className="details" role="group" aria-label="Session details">
        {DETAIL_FIELDS.map(({ key, label }) => (
          <div key={key} className="details__field">
            <label htmlFor={`detail-${key}`}>{label}</label>
            <input
              id={`detail-${key}`}
              className="details__input"
              value={state.details[key]}
              readOnly={readOnly}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => dispatch({ type: 'setDetail', key, value: e.target.value })}
            />
            <span className="print-text" aria-hidden="true">
              {state.details[key]}
            </span>
          </div>
        ))}
      </div>
    </header>
  );
}
