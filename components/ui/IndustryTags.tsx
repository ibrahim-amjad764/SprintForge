// components/ui/IndustryTags.tsx
"use client";

interface IndustryTagsProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
}

const industries = [
  'Engineering',
  'Marketing',
  'Product Management',
  'Operations',
  'Sales',
  'Design',
  'Finance',
  'HR',
  'Legal',
  'Customer Success',
];

export function IndustryTags({ selectedTags, onTagsChange, disabled = false }: IndustryTagsProps) {
  const toggleTag = (tag: string) => {
    if (disabled) return;
    
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Workspace Purpose / Industry</label>
      
      <div className="flex flex-wrap gap-2">
        {industries.map((industry) => (
          <button
            key={industry}
            type="button"
            onClick={() => toggleTag(industry)}
            disabled={disabled}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${selectedTags.includes(industry)
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-muted text-foreground hover:bg-muted'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {industry}
          </button>
        ))}
      </div>
      
      {selectedTags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
