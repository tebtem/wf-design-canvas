import { Component, lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { RichView } from './RichView';
import { richToText, toRichHtml } from './richText';

// The editor downloads the first time someone heads for a note (hover, focus or click), then stays cached.
export const loadEditor = () => import('./RichText');
const RichText = lazy(loadEditor);

/** If the editor ever fails to load or crashes, show the text instead of breaking the page. */
class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  value: string;
  label: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  /** Titles ("# ") are only for Activities. */
  allowTitle?: boolean;
  /** Class for the text area (both display and editing), e.g. sticky__text. */
  className?: string;
  placeholder?: string;
  /** Start in editing mode with the cursor in the note (a brand-new sticky). */
  autoEdit?: boolean;
}

/**
 * Text with bold (Ctrl/Cmd+B), italic (Ctrl/Cmd+I), "- " bullets and, where allowed, "# " titles.
 * Shows formatted text until someone clicks or tabs in, then switches to the editor.
 */
export function RichNote({
  value,
  label,
  onChange,
  readOnly = false,
  allowTitle = false,
  className = '',
  placeholder = '',
  autoEdit = false,
}: Props) {
  const [editing, setEditing] = useState(autoEdit && !readOnly);
  // After Escape, focus returns to the note itself (without reopening the editor).
  const viewRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const skipStart = useRef(false);
  useEffect(() => {
    if (editing || !refocus.current) return;
    refocus.current = false;
    skipStart.current = true;
    viewRef.current?.focus();
  }, [editing]);
  const empty = !richToText(toRichHtml(value));

  if (editing && !readOnly) {
    const shown = (
      <div className={`rich-note ${className}`}>
        <RichView value={value} allowTitle={allowTitle} />
      </div>
    );
    return (
      <EditorBoundary fallback={shown}>
        <Suspense fallback={shown}>
          <RichText
            value={value}
            label={label}
            allowTitle={allowTitle}
            className={`rich-note ${className}`}
            onChange={onChange}
            onDone={(how) => {
            setEditing(false);
            if (how === 'escape') refocus.current = true;
          }}
          />
        </Suspense>
      </EditorBoundary>
    );
  }

  const start = () => {
    if (skipStart.current) {
      skipStart.current = false;
      return;
    }
    if (!readOnly) setEditing(true);
  };
  return (
    <div
      ref={viewRef}
      className={`rich-note rich-note--view ${className}`}
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
      tabIndex={0}
      onFocus={start}
      onMouseEnter={() => void loadEditor()}
      onPointerDown={() => void loadEditor()}
      onClick={start}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          start();
        }
      }}
    >
      {empty ? (
        !readOnly && placeholder && <span className="rich-note__placeholder">{placeholder}</span>
      ) : (
        <RichView value={value} allowTitle={allowTitle} />
      )}
    </div>
  );
}
