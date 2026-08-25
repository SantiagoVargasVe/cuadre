import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../server/auth/session";

export default async function HomePage() {
  const session = await getSessionFromCookies();
  redirect(session ? "/groups" : "/login");
}
