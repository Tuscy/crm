import { getMyTasks } from "@/lib/server/actions/tasks";
import { PersonalTaskList } from "@/components/dashboard/personal-task-list";
import { taskCompletedHideAfterDays } from "@/lib/tasks/retention";

export default async function TasksPage() {
  const tasks = await getMyTasks();
  const hideAfterDays = taskCompletedHideAfterDays();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <PersonalTaskList tasks={tasks} hideAfterDays={hideAfterDays} />
    </div>
  );
}
