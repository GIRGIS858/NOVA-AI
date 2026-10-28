"use client";
import { useState } from "react";
import Link from "next/link";
import { createAuthClient } from "better-auth/react";
import { ArrowUpLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/locale";
const client = createAuthClient();
export function AuthForm({ locale, next }: { locale: Locale; next: string }) {
  const ar = locale === "ar";
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const values = {
      email: String(data.get("email")),
      password: String(data.get("password")),
    };
    try {
      const result = signup
        ? await client.signUp.email({
            ...values,
            name: String(data.get("name")),
          })
        : await client.signIn.email(values);
      if (result.error) {
        setError(
          result.error.status === 429
            ? ar
              ? "طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا."
              : "Too many attempts. Please wait and try again."
            : ar
              ? "تعذّر إكمال الطلب. تحقق من بياناتك، أو جرّب تسجيل الدخول إذا كان لديك حساب."
              : "Could not continue. Check your details, or sign in if you already have an account.",
        );
      } else window.location.assign(next);
    } catch {
      setError(
        ar
          ? "تعذّر الاتصال بالخادم. بيانات النموذج ما زالت هنا."
          : "Could not reach the server. Your form is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="auth-tabs"
        role="group"
        aria-label={ar ? "نوع الحساب" : "Account action"}
      >
        <button
          type="button"
          className={!signup ? "selected" : ""}
          onClick={() => {
            setSignup(false);
            setError("");
          }}
          disabled={busy}
        >
          {ar ? "تسجيل الدخول" : "Sign in"}
        </button>
        <button
          type="button"
          className={signup ? "selected" : ""}
          onClick={() => {
            setSignup(true);
            setError("");
          }}
          disabled={busy}
        >
          {ar ? "حساب جديد" : "Create account"}
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        {signup && (
          <label>
            {ar ? "اسمك" : "Your name"}
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={ar ? "بماذا نناديك؟" : "What should we call you?"}
            />
          </label>
        )}
        <label>
          {ar ? "البريد الإلكتروني" : "Email address"}
          <input
            type="email"
            dir="ltr"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </label>
        <div>
          <label htmlFor="password">{ar ? "كلمة المرور" : "Password"}</label>
          <input
            id="password"
            aria-describedby="password-help"
            type="password"
            dir="ltr"
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={12}
            maxLength={128}
          />
          <small id="password-help">
            {ar
              ? "12 حرفًا على الأقل. استخدم كلمة مرور فريدة."
              : "At least 12 characters. Use a unique password."}
          </small>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary wide" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ArrowUpLeft size={18} />
          )}{" "}
          {signup
            ? ar
              ? "أنشئ مساحة لأفكارك"
              : "Create your workspace"
            : ar
              ? "ادخل مساحة العمل"
              : "Open your workspace"}
        </button>
      </form>
      <p className="auth-footnote">
        <ShieldCheck size={15} />
        {ar
          ? "لا نطلب مفاتيح API عند إنشاء الحساب."
          : "No API keys needed to create an account."}
      </p>
      <p className="auth-footnote">
        {ar
          ? "نسخة تطويرية. التحقق بالبريد واستعادة كلمة المرور غير متاحين بعد."
          : "Development release. Email verification and password recovery are not available yet."}
      </p>
      <Link className="text-link" href="/roadmap">
        {ar ? "اطّلع على حالة المنتج" : "Read the product status"}
      </Link>
    </>
  );
}
