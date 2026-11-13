import { useEffect, useRef } from 'react';
import { EditorContent, textblockTypeInputRule, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import { toRichHtml } from './richText';

interface Props {
  value: string;
  label: string;
  className?: string;
  allowTitle?: boolean;
  onChange: (html: string) => void;
  /** Called when the person leaves the note: 'escape' (keep focus on the note) or 'blur' (they moved on). */
  onDone: (how: 'escape' | 'blur') => void;
}

/**
 * The editor behind RichNote: bold, italic, "- " bullets and, if allowed, "# " titles. No toolbar.
 * Loaded lazily so it only downloads once someone starts editing.
 */
export default function RichText({ value, label, className = '', allowTitle = false, onChange, onDone }: Props) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  const attributes = { class: className, role: 'textbox', 'aria-multiline': 'true', 'aria-label': label };

  const editor = useEditor({
    extensions: [
      ...(allowTitle
        ? [
            // One title size. Typing "# " (or "### ") at the start of a line makes a title.
            Heading.configure({ levels: [3] }).extend({
              addInputRules() {
                return [textblockTypeInputRule({ find: /^#{1,3}\s$/, type: this.type, getAttributes: { level: 3 } })];
              },
            }),
          ]
        : []),
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        underline: false,
        link: false,
      }),
    ],
    content: toRichHtml(value),
    autofocus: 'end',
    editorProps: {
      attributes,
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          done.current('escape');
          return true;
        }
        return false;
      },
    },
    // Empty lines at the very end are not kept.
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML().replace(/(<p><\/p>)+$/, '')),
    onBlur: () => done.current('blur'),
  });

  // Keep in step with outside changes while open but not focused (rare: a restore mid-edit).
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    const next = toRichHtml(value);
    if (next !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
