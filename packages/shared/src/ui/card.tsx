import { type JSX, type ReactNode } from "react";

export function Card({
  className,
  title,
  children,
  href,
}: {
  className?: string;
  title: string;
  children: ReactNode;
  href?: string;
}): JSX.Element {
  const body = (
    <>
      <h2>{title}</h2>
      <p>{children}</p>
    </>
  );

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <a
      className={className}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {body}
    </a>
  );
}
