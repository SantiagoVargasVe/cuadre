import "server-only";
import type { MailMessage } from "../index";
import { mailEs } from "../copy-es";
import { renderLinkEmail } from "./link-email";

/** The password-reset message body, built from one absolute link. */
export function renderPasswordResetEmail(link: string): Omit<MailMessage, "to"> {
  return renderLinkEmail(mailEs.passwordReset, link);
}
