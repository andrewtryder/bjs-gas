import { permanentRedirect } from "next/navigation";

/** Bookmarks and old nav continue to work; the public page is /about. */
export default function StatusRedirectPage() {
  permanentRedirect("/about");
}
