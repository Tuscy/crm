import { getTodayItems } from "@/lib/server/actions/today";
import { TodayView } from "@/components/dashboard/today-view";

export default async function TodayPage() {
  const items = await getTodayItems();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overdue tasks, items due today, and opportunities needing next actions
        </p>
      </div>
      <TodayView items={items} />
    </div>
  );
}
