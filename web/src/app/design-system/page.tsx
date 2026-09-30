import { notFound } from "next/navigation";
import { DesignSystemPreview } from "../../components/ui/DesignSystemPreview";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignSystemPreview />;
}
