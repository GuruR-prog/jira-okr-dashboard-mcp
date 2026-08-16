import type { Ticket } from "@jira-dashboard/core";

export function StatusBadge({ status, statusCategory }: { status: string; statusCategory: Ticket["statusCategory"] }) {
  return <span className={`status-badge status-${statusCategory}`}>{status}</span>;
}
