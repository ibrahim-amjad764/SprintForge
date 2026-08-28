// components/files/FileList.tsx
export default function FileList({ files }: { files: any[] }) {
  return (
    <div>
      {files.map((file) => (
        <div
          key={file._id}

          className="border p-3"
        >
          <a
            href={file.url}

            target="_blank"
          >
            {file.name}
          </a>
        </div>
      ))}
    </div>
  );
}
