import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <SkeletonTable columns={5} />
    </div>
  );
}
