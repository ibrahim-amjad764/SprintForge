// components/workspace/WorkspaceCard.tsx

interface Props {
  name: string;
}

export default function WorkspaceCard({ name }: Props) {
  return (
    <div className="border rounded p-5">
      <h2 className="font-bold text-xl">{name}</h2>
    </div>
  );
}
