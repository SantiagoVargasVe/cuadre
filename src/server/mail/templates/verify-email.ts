import "server-only";
import type { MailMessage } from "../index";
import { mailEs } from "../copy-es";
import { renderLinkEmail } from "./link-email";

/** The verification message body, built from one absolute link. */
export function renderVerifyEmail(link: string): Omit<MailMessage, "to"> {
  return renderLinkEmail(mailEs.verifyEmail, link);
}
