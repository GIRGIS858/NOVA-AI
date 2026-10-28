import Link from "next/link";
import { getLocale } from "@/lib/locale";
export default async function NotFound() {
  const ar = (await getLocale()) === "ar";
  return (
    <main className="error-page">
      <span className="overline">404 / NOVA</span>
      <h1>{ar ? "هذه الصفحة غير متاحة." : "This page isn’t available."}</h1>
      <p>
        {ar
          ? "قد يكون الرابط غير صحيح، أو المشروع غير متاح لحسابك."
          : "The link may be incorrect, or the project is not available to your account."}
      </p>
      <Link className="button dark" href="/app">
        {ar ? "العودة للمشاريع" : "Back to projects"}
      </Link>
    </main>
  );
}
