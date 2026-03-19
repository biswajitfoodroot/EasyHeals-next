import BookingClient from "./BookingClient";

export const metadata = { title: "Book Appointment | EasyHeals" };

export default async function BookingPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  return <BookingClient providerId={providerId} />;
}
