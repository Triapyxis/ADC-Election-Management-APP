import Link from "next/link";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (<><header className="border-b border-rule bg-paper-raised"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"><span className="font-semibold">Nigeria Election Monitor</span><Link href="/" className="text-sm text-ink-soft hover:underline">Public results</Link></div></header><main className="mx-auto max-w-3xl px-4 py-10">{children}</main></>);
}
