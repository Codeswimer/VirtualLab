import { FileText, Info } from 'lucide-react';

export function NotesPanel({
  notes,
  onChange,
  prompts,
}: {
  notes: string;
  onChange: (value: string) => void;
  prompts: string[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <FileText className="h-4 w-4 text-ink-400" />
        Conclusion &amp; evaluation
      </h3>
      <p className="mt-0.5 text-xs text-ink-500">
        Write the conclusion an examiner would expect: what you found, the value, and one source of
        error.
      </p>
      <textarea
        value={notes}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        className="input mt-3 resize-y leading-relaxed"
        placeholder="From my graph, g = ... This agrees with the accepted value to within ... The main source of error was ..."
        aria-label="Conclusion and evaluation"
      />
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{notes.trim().split(/\s+/).filter(Boolean).length} words</span>
        <span>Marked on the key ideas, not exact wording</span>
      </div>

      <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
          <Info className="h-3.5 w-3.5" /> A complete conclusion mentions
        </p>
        <ul className="mt-2 space-y-1.5">
          {prompts.map((prompt, index) => (
            <li key={prompt} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-600">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white font-mono text-[9px] font-bold text-ink-400">
                {index + 1}
              </span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
