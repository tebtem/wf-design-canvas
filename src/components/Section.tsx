import { useId, type ReactNode } from 'react';

interface Props {
  title: string;
  /** Anchor so guided workshops can jump to a newly revealed section. */
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Section({ title, id: anchor, className = '', children }: Props) {
  const id = useId();
  return (
    <section id={anchor} className={`band ${className}`} aria-labelledby={id}>
      <h2 id={id} className="band__title" tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}

