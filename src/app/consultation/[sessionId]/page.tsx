import type { Metadata } from "next";
import ConsultationRoom from "./ConsultationRoom";

export const metadata: Metadata = {
  title: "Consultation Room | EasyHeals",
  description: "Secure online video consultation",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function ConsultationRoomPage({ params }: Props) {
  const { sessionId } = await params;
  return <ConsultationRoom sessionId={sessionId} />;
}
