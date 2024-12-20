import Link from "next/link";
import Logo from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useRouter } from "next/router";

export default function Header() {
  const router = useRouter();
  const isHomePage = router.pathname === "/";
  const isAuthPage = router.pathname.startsWith("/auth/");

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>

        <nav className="flex items-center gap-4">
          <ThemeToggle />
          {!isAuthPage && !isHomePage && (
            <>
              <Link href="/auth/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button className="bg-sky-400 hover:bg-sky-500">Get Started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}