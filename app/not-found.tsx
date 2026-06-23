import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-heading font-bold text-primary/20 select-none mb-2">404</p>
      <h1 className="font-heading text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-xs">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
        Go to Dashboard
      </Link>
    </div>
  );
}
