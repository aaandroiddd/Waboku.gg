import { useRouter } from 'next/router';
import Logo from './Logo';
import { Button } from './ui/button';
import { useTheme } from './ThemeProvider';
import { Moon, Sun } from 'lucide-react';

const Header = () => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <div className="w-full">
      <div className="flex justify-between items-center py-4 px-4 sm:px-6 lg:px-8">
        <div className="cursor-pointer" onClick={() => router.push("/")}>
          <Logo />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default Header;