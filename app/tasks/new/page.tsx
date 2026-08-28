// app/tasks/new/page.tsx
import MainLayout from '@/components/layout/MainLayout';

export default function NewTaskPage() {
  return (
    <MainLayout>
      <div className="p-10">
        <h1 className="mb-8 text-3xl font-bold">Create New Task</h1>
        <p className="text-gray-500">Task creation form will be implemented here.</p>
      </div>
    </MainLayout>
  );
}
