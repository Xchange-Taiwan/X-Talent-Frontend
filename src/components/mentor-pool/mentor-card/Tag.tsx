interface TagProps {
  label: string;
}

export const Tag = ({ label }: TagProps) => {
  return (
    <div className="rounded-md border border-[#E6E8EA] px-3 py-1.5 text-sm font-medium tracking-wide">
      {label}
    </div>
  );
};
