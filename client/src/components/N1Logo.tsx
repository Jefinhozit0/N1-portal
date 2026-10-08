import React from "react";

interface N1LogoProps {
  compact?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const N1Logo: React.FC<N1LogoProps> = ({
  compact = false,
  size = "md",
  className = "",
}) => {
  const height = compact
    ? size === "sm" ? 32 : 38
    : size === "sm" ? 36 : size === "lg" ? 62 : size === "xl" ? 82 : 46;

  return (
    <div
      className={`n1-brand-logo ${compact ? "is-compact" : ""} ${className}`}
      title="N1 Soluções"
    >
      <img
        src="/n1-logo.png"
        alt="N1 Soluções"
        style={{
          height: `${height}px`,
          width: "auto",
          objectFit: "contain",
          display: "block",
          borderRadius: "6px",
        }}
        className="n1-logo-img"
      />
    </div>
  );
};

export default N1Logo;
