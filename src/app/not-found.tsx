import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-md font-semibold text-ink">Not found</p>
      <p className="text-base text-ink-3">That page does not exist.</p>
      <Link href="/" className="text-base text-link-z hover:underline">
        Back to zestman.xyz
      </Link>
    </main>
  );
}
