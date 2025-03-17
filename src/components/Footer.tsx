import Link from "next/link";
import { Button } from "./ui/button";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <Button
              variant="link"
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-primary"
            >
              Top
            </Button>
            <Link href="/" passHref>
              <Button variant="link" className="text-muted-foreground hover:text-primary">
                Home
              </Button>
            </Link>
            <Link href="/about" passHref>
              <Button variant="link" className="text-muted-foreground hover:text-primary">
                About Us
              </Button>
            </Link>
            <Link href="/faq" passHref>
              <Button variant="link" className="text-muted-foreground hover:text-primary">
                FAQ
              </Button>
            </Link>
            <Link href="/privacy-policy" passHref>
              <Button variant="link" className="text-muted-foreground hover:text-primary">
                Privacy Policy
              </Button>
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Waboku.gg. All rights reserved.
          </div>
        </div>
      </div>
      <div className="w-full bg-amber-100 dark:bg-amber-900/60 py-2 text-center text-sm">
        <p className="text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Beta Version:</span> This application is currently under development. Some features may be incomplete or change without notice.
        </p>
      </div>
    </footer>
  );
}