// Route labels and page descriptions belong to app composition, not UI primitives.
export const pageTitles: Record<string, string> = {
  "/": "Home",
  "/inquire": "Send an inquiry",
  "/admin/inquiries": "Inquiries",
  "/components": "Interface essentials",
  "/account/enquiries": "My enquiries",
  "/account": "My account",
  "/account/security": "Account security",
  "/account/two-factor": "Two-factor authentication",
  "/account/billing": "My billing",
  "/account/notifications": "Notifications",
  "/invite": "Team invitation",
  "/workspace": "My records",
  "/admin": "Business overview",
  "/admin/team": "Team",
  "/admin/accounts": "Accounts",
  "/admin/business": "Business settings",
  "/admin/contacts": "Contacts",
  "/admin/files": "Files",
  "/admin/notifications": "Scheduled notifications",
  "/admin/billing": "Billing",
  "/admin/billing/new": "New invoice",
  "/admin/audit": "Audit trail",
};

export const pageDescriptions: Record<string, string> = {
  Billing: "Create invoices and track outstanding balances.",
  Inquiries: "Review customer requests and create contacts.",
  Contacts: "Manage contact details and private notes.",
  Overview: "Your business workspace at a glance.",
  Accounts: "Find and manage registered accounts.",
  Team: "Manage your team and their access.",
  "Business settings":
    "Manage your business profile, preferences and locations.",
  Files: "Manage uploaded files and their availability.",
  "Audit trail": "Review changes across your workspace.",
};
