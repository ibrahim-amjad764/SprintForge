// components/team/TeamCard.tsx

interface Props {
  name: string;
}

export default function TeamCard({ name }: Props) {
  return (
    <div className="border rounded p-5">
      <h2 className="font-bold text-xl">{name}</h2>

      <p className="text-gray-500">Team</p>
    </div>
  );
}
