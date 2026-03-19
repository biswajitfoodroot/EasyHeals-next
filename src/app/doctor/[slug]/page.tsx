import { redirect } from "next/navigation";

type Params = { params: Promise<{ slug: string }> };

export default async function DoctorAliasPage({ params }: Params) {
  const { slug } = await params;
  redirect(`/doctors/${slug}`);
}
