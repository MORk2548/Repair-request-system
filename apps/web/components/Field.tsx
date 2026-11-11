import { useId, type ReactNode } from 'react';

type ControlProps = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string };

// useId keeps ids unique when several copies of a form (one per table row) are on the page
export function Field({ label, error, children }: { label: string; error?: string | undefined; children: (props: ControlProps) => ReactNode }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(error ? { id, 'aria-invalid': true, 'aria-describedby': errorId } : { id })}
      {error && (
        <p id={errorId} className="error">
          {error}
        </p>
      )}
    </div>
  );
}

type Issues = { issues: readonly { path: readonly PropertyKey[]; message: string }[] };

export function fieldErrors<K extends string>(error: Issues): Partial<Record<K, string>> {
  const found: Partial<Record<K, string>> = {};
  for (const issue of error.issues) found[String(issue.path[0]) as K] ??= issue.message;
  return found;
}
