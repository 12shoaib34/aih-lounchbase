import { escapeHtml } from "../shared/product";
export function notificationEmail(title: string, body: string, url: string) {
  return {
    subject: title,
    text: `${title}\n\n${body}\n\nView your notifications and preferences: ${url}`,
    html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body).replaceAll("\n", "<br>")}</p><p><a href="${escapeHtml(url)}">View notifications and preferences</a></p>`,
  };
}
export function actionEmail(subject: string, url: string) {
  return {
    subject,
    text: `${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<h1>${escapeHtml(subject)}</h1><p><a href="${escapeHtml(url)}">${escapeHtml(subject)}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}
