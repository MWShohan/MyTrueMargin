import type { StatusCode } from '../engine';
import { STATUS_INFO } from '../lib/labels';

export function StatusBadge({ status, title }: { status: StatusCode; title?: string }) {
  const info = STATUS_INFO[status];
  return (
    <span className={`badge tone-${info.tone}`} title={title} data-status={status}>
      <span className="badge-icon" aria-hidden="true">
        {info.icon}
      </span>
      {info.label}
    </span>
  );
}
