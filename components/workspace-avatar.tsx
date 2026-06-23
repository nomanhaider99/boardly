interface WorkspaceAvatarProps {
  name: string;
  iconColor: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
};

export function WorkspaceAvatar({
  name,
  iconColor,
  size = "md",
}: WorkspaceAvatarProps) {
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-xl font-heading font-bold text-white`}
      style={{ backgroundColor: iconColor }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
