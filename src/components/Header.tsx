import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { useRouter } from "next/router";

export default function Header() {
  const router = useRouter();
  const isAuthPage = router.pathname.startsWith("/auth/");

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Logo />
          <span className="font-bold text-xl">Waboku.gg</span>
        </Link>

        <nav className="flex items-center gap-4">
          {!isAuthPage && (
            <>
              <Link href="/auth/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button>Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}