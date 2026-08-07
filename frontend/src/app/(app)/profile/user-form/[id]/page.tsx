import UserFormPage from "../../_userform";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  return <UserFormPage editId={Number(id)} />;
}