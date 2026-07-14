const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  pending:          { label: "Pending",          bg: "#FBF3E5", text: "#8A6D1F" },
  preparing:        { label: "Preparing",        bg: "#EAF1FB", text: "#1D5A99" },
  ready:            { label: "Ready",            bg: "#E6F2EF", text: "#1F6F54" },
  completed:        { label: "Completed",        bg: "#F0F1ED", text: "#494D46" },
  dispatched:       { label: "Dispatched",       bg: "#F0F1ED", text: "#494D46" },
  delivered:        { label: "Delivered",        bg: "#E6F2EF", text: "#1F6F54" },
  cancelled:        { label: "Cancelled",        bg: "#FBEAE7", text: "#9E3527" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, bg: "#EEE", text: "#444" };
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}