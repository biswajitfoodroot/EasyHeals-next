import PrevisitBriefClient from "./PrevisitBriefClient";

export const metadata = { title: "Pre-Visit Brief | EasyHeals" };

export default async function PrevisitBriefPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  return <PrevisitBriefClient appointmentId={appointmentId} />;
}
