export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-[#E3E5E0] rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-[#6B7068]">{label}</p>
      <p className="mono-num text-2xl font-medium text-[#1B1D1E] mt-1">{value}</p>
    </div>
  );
}