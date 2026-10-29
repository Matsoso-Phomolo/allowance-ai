export default function WorkspaceIcon({ name, size = 20 }) {
  const paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    budget: "M4 6h15v14H4zM4 6V4h13M15 11h6v5h-6z",
    categories: "M3 4h8l10 10-7 7L3 10zM7 8h.01",
    expenses: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3",
    planning: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h6",
    shopping: "M3 3h2l3 12h10l3-9H6M9 20h.01M18 20h.01",
    analytics: "M4 3v18h17M8 17v-6M13 17V7M18 17V4",
    intelligence: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    notifications: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4",
    profile: "M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 21v-3a8 8 0 0 1 16 0v3",
    admin: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-4",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M6 18 18 6",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    plus: "M12 5v14M5 12h14",
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
