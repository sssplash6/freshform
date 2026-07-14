import { redirect } from "next/navigation";

/**
 * The standalone students list is gone: students are managed inside each
 * program's page, reached from the dashboard islands. Old links land here.
 */
export default function AdminStudentsIndex() {
  redirect("/admin");
}
