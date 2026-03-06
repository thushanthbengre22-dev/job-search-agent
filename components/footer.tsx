import { GithubIcon } from "./icons/github"
import { LinkedinIcon } from "./icons/linkedin"

export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <p className="font-mono text-xs text-muted-foreground">
          {"© 2026 — Built with Next.js & Tailwind CSS"}
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/thushanthbengre22-dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label="GitHub"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
          <a
            href="https://www.linkedin.com/in/thushanth-devananda-bengre/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label="LinkedIn"
          >
            <LinkedinIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  )
}