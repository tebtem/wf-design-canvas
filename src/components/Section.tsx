import { useId, type ReactNode } from 'react';

interface Props {
  title: string;
  className?: string;
  children: ReactNode;
}

export function Section({ title, className = '', children }: Props) {
  const id = useId();
  return (
    <section className={`band ${className}`} aria-labelledby={id}>
      <h2 id={id} className="band__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

