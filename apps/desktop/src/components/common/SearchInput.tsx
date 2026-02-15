interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = '검색...' }: SearchInputProps) {
  return (
    <div className="search-bar" style={{ marginBottom: '1rem' }}>
      <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>search</span>
      <input
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
