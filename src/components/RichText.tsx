import { useEffect } from 'react';
import { EditorContent, textblockTypeInputRule, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import { toRichHtml } from './richText';

interface Props {
  value: string;
  label: string;
  readOnly?: boolean;
  onChange: (html: string) => void;
}

/**
 * A small rich text field: a title, bold, italic and bullet lists, nothing else. Loaded lazily so the
 * editor library only downloads when the Session Outline is on screen.
 */
export default function RichText({ value, label, readOnly = false, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      // One title size. Typing "# " (or "### ") at the start of a line makes a title.
      Heading.configure({ levels: [3] }).extend({
        addInputRules() {
          return [textblockTypeInputRule({ find: /^#{1,3}\s$/, type: this.type, getAttributes: { level: 3 } })];
        },
      }),
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
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'rich__content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Keep in step with outside changes (a restored backup, or a facilitator watching live).
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    const next = toRichHtml(value);
    if (next !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly);
  }, [editor, readOnly]);
  useEffect(() => {
    if (editor && !editor.isDestroyed)
      editor.setOptions({
        editorProps: {
          attributes: { class: 'rich__content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
        },
      });
  }, [editor, label]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      title: e?.isActive('heading', { level: 3 }) ?? false,
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      bullets: e?.isActive('bulletList') ?? false,
    }),
  });

  const tool = (name: string, pressed: boolean, run: () => void, content: React.ReactNode, hint: string) => (
    <button
      type="button"
      className="rich__tool"
      aria-pressed={pressed}
      aria-label={name}
      title={hint}
      // Keep the text selection while clicking a button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {content}
    </button>
  );

  return (
    <div className={`rich${readOnly ? ' rich--readonly' : ''}`}>
      {!readOnly && editor && (
        <div className="rich__toolbar no-print" role="toolbar" aria-label={`Formatting for ${label}`}>
          {tool(
            'Title',
            active?.title ?? false,
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            'T',
            'Title (type # and a space)',
          )}
          {tool(
            'Bold',
            active?.bold ?? false,
            () => editor.chain().focus().toggleBold().run(),
            <b>B</b>,
            'Bold (Ctrl or Cmd + B)',
          )}
          {tool(
            'Italic',
            active?.italic ?? false,
            () => editor.chain().focus().toggleItalic().run(),
            <i>I</i>,
            'Italic (Ctrl or Cmd + I)',
          )}
          {tool(
            'Bullets',
            active?.bullets ?? false,
            () => editor.chain().focus().toggleBulletList().run(),
            '•',
            'Bullets (type - and a space)',
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
