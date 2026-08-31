/**
 * The group name for the header — "where relevant" per T060, i.e. only on
 * /g/[groupId]. Rendered by the group layout from data it already fetched
 * (`getGroupDetail`), so this is a plain server component: no client query,
 * no second round trip (T106). Non-membership is handled upstream — a 404
 * from that fetch redirects to /groups before this renders.
 */
export function GroupHeading({ title }: { title: string }) {
  return <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>;
}
