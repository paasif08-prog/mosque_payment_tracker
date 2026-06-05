import { redirect } from 'next/navigation';
import { createServerClientInstance } from './supabase-server';

export async function verifyAdmin() {
  const supabase = await createServerClientInstance();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if the user exists in the public.admins table
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .single();

  if (error || !admin) {
    console.warn(`Unauthorized access attempt by authenticated user ${user.id} (${user.email})`);
    
    // Sign out unauthorized user
    await supabase.auth.signOut();
    redirect('/login?error=unauthorized');
  }

  return user;
}
