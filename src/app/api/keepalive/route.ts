import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Always run on request — never statically cached.
export const dynamic = 'force-dynamic';

// Hit daily by a Vercel Cron (see vercel.json). A trivial read registers
// database activity so Supabase does not auto-pause the free-tier project
// after 7 days of inactivity.
export async function GET() {
  try {
    const { error } = await supabase.from('shopping_list').select('id').limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error' }, { status: 500 });
  }
}
