import { redirect } from "next/navigation";

type Params = { params: Promise<{ slug: string }> };

export default async function HospitalAliasPage({ params }: Params) {
  const { slug } = await params;
  redirect(`/hospitals/${slug}`);
}
