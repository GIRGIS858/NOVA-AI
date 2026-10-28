import { Languages } from "lucide-react";
import { switchLocale } from "@/app/actions";
import type { Locale } from "@/lib/locale";
export function LocaleButton({ locale }: { locale: Locale }) {
  return (
    <form action={switchLocale}>
      <input
        type="hidden"
        name="locale"
        value={locale === "ar" ? "en" : "ar"}
      />
      <button className="button ghost small" type="submit">
        <Languages size={16} />
        {locale === "ar" ? "English" : "العربية"}
      </button>
    </form>
  );
}
