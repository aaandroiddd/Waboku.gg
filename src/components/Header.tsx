import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { useRouter } from "next/router";
import { ThemeToggle } from "./ThemeToggle";

export default function Header() {
  const router = useRouter();
  const isAuthPage = router.pathname.startsWith("/auth/");

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>

        <nav className="flex items-center gap-4">
          <ThemeToggle />
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