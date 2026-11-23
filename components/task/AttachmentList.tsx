// components/task/AttachmentList.tsx

export default function AttachmentList({ files }: { files: any[] }) {
  return (
    <div>
      <h2 className="font-bold">Files</h2>

      {files.map((file) => (
        <a
          key={file._id}
          href={file.url}
          target="_blank"
          className="block text-blue-600 dark:text-blue-300"
        >
          {file.name}
        </a>
      ))}
    </div>
  );
}
