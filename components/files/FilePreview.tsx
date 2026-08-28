// components/files/FilePreview.tsx

export default function FilePreview({
  url,

  type,
}: {
  url: string;

  type: string;
}) {
  if (type === 'image')
    return (
      <img
        src={url}

        className="w-40"
      />
    );

  return (
    <a
      href={url}

      target="_blank"
    >
      Open File
    </a>
  );
}
