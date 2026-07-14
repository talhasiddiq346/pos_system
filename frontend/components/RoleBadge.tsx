const ROLE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  super_admin: { label: "Super admin", bg: "#FBEFE5", text: "#9A4E1F" },
  branch_admin: { label: "Branch admin", bg: "#E6F2EF", text: "#1F6F54" },
  cashier: { label: "Cashier", bg: "#EAF1FB", text: "#1D5A99" },
  call_center: { label: "Call center", bg: "#F3EAFB", text: "#6B2F9A" },
  delivery: { label: "Delivery", bg: "#FBE9E6", text: "#9A2F1F" },
  chef: { label: "Chef", bg: "#FBF6E5", text: "#8A6D1F" },
};

export default function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] ?? { label: role, bg: "#EEE", text: "#444" };
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}