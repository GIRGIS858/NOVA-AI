import Link from "next/link";
import { Sparkles } from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Nova home">
      <span className="brand-icon">
        <Sparkles size={21} />
      </span>
      <span dir="ltr">
        nova<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
