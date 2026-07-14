export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F5F6F4] flex items-center justify-center">
      <div className="space-y-3 w-full max-w-sm px-6">
        <div className="h-4 bg-[#E3E5E0] rounded-full animate-pulse w-3/4 mx-auto" />
        <div className="h-4 bg-[#E3E5E0] rounded-full animate-pulse w-1/2 mx-auto" />
      </div>
    </div>
  );
}