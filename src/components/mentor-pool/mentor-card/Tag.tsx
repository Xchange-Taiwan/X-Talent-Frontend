interface TagProps {
  label: string;
}

export const Tag = ({ label }: TagProps) => {
  return (
    <div className="border-background-border rounded-md border px-3 py-1.5 text-sm font-medium tracking-wide">
      {label}
    </div>
  );
};
