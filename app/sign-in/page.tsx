import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SignInForm from "@/components/sign-in-form";
import { auth, ownerExists } from "@/lib/auth";

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent />
    </Suspense>
  );
}

async function SignInContent() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return <SignInForm setupRequired={!(await ownerExists())} />;
}

function SignInFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f5f7] px-4">
      <div className="h-[430px] w-full max-w-[420px] animate-pulse rounded-2xl bg-white" />
    </main>
  );
}
