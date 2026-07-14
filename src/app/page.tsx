import { redirect } from "next/navigation";

/** Land on the PDV — the primary workflow. */
export default function Home() {
  redirect("/pos");
}
