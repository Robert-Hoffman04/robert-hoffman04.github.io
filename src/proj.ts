export interface Project {
  title: string;
  description: string;
  kind: "professional" | "hobby";
  tags: string[];
  href?: string;
  repo?: string;
}

// Placeholder content — swap these out for real projects.
export const projects: Project[] = [
  {
    title: "Student Records Portal",
    description:
      "Internal web app built during my time as a Junior Application Developer for staff to manage and troubleshoot student records, replacing a set of manual spreadsheet workflows.",
    kind: "professional",
    tags: ["Python", "JavaScript", "SQL"],
    href: "#",
  },
  {
    title: "Automated Report Pipeline",
    description:
      "A scheduled data pipeline that pulls from several internal systems, reconciles the results, and produces a shareable report for staff — cut a manual weekly task down to a few minutes.",
    kind: "professional",
    tags: ["Python", "Automation"],
    href: "#",
  },
  {
    title: "This Portfolio Site",
    description:
      "The site you're on right now — an Astro + Tailwind build with a hand-rolled liquid-glass navigation component, spring physics, and a WebGL Rubik's cube on the home page.",
    kind: "hobby",
    tags: ["Astro", "TypeScript", "Three.js"],
    repo: "https://github.com/Robert-Hoffman04/robert-hoffman04.github.io",
  },
  {
    title: "Rubik's Cube Solver",
    description:
      "A from-scratch cube state model and solver, built to sharpen my grip on spatial reasoning and search algorithms outside of a work context.",
    kind: "hobby",
    tags: ["C++", "Algorithms"],
    repo: "#",
  },
  {
    title: "Weekend Game Jam Entry",
    description:
      "A small arcade-style game put together over a weekend to practice a full build-and-ship loop end to end, from mechanics to polish.",
    kind: "hobby",
    tags: ["Rust", "Game Dev"],
    repo: "#",
  },
];