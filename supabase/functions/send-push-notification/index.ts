import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing Supabase or VAPID environment variables.');
    }

    const { message, target = 'ALL', sender = '' } = await req.json();
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const normalizedTarget = String(target || 'ALL').toUpperCase();

    let query = supabase.from('push_subscriptions').select('*');
    if (normalizedTarget !== 'ALL') {
      query = query.or(`user_role.eq.${normalizedTarget},user_id.eq.${target}`);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({
      title: sender ? `تنبيه من ${sender}` : 'تنبيه من الكنترول',
      body: message || 'تنبيه جديد من الكنترول',
      url: '/',
      requireInteraction: true,
    });

    const results = await Promise.allSettled((subscriptions || []).map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        return { ok: true, endpoint: row.endpoint };
      } catch (sendError: any) {
        if ([404, 410].includes(Number(sendError?.statusCode))) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        }
        throw sendError;
      }
    }));

    const sent = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
