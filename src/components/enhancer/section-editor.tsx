import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, List, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/** Minimal Tiptap editor: bold, bullet list, clear formatting only. */
export function SectionEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false })],
    content: textToHtml(value),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[80px] focus:outline-none px-3 py-2 rounded-md border bg-background",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(htmlToText(editor.getHTML()));
    },
  });

  // If parent replaces value (e.g. "Use suggested rewrite"), sync.
  useEffect(() => {
    if (!editor) return;
    const current = htmlToText(editor.getHTML());
    if (current !== value) {
      editor.commands.setContent(textToHtml(value), { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
        {placeholder ?? "Loading editor…"}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          label="Clear formatting"
        >
          <Eraser className="size-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("h-7 px-2", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const html: string[] = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-•*]\s+/.test(trimmed)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${trimmed.replace(/^[-•*]\s+/, "")}</li>`);
    } else {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (trimmed) html.push(`<p>${line}</p>`);
      else html.push("<p></p>");
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function htmlToText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const div = document.createElement("div");
  div.innerHTML = html;
  const out: string[] = [];
  for (const node of Array.from(div.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "UL" || el.tagName === "OL") {
        for (const li of Array.from(el.querySelectorAll("li"))) {
          out.push(`• ${(li.textContent ?? "").trim()}`);
        }
      } else {
        out.push((el.textContent ?? "").trim());
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      out.push((node.textContent ?? "").trim());
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
