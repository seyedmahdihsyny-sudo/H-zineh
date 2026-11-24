import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return Response.json({ error: "ورود معتبر لازم است." }, { status: 401 });
  const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return Response.json({ error: "فقط مدیر اصلی اجازه ساخت کاربر دارد." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.display_name || "").trim();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return Response.json({ error: "نام کاربری باید ۳ تا ۳۰ حرف انگلیسی، عدد یا زیرخط باشد." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, { status: 400 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: existing } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (existing) return Response.json({ error: "این نام کاربری قبلاً استفاده شده است." }, { status: 409 });

  const email = username + "@hzineh.local";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName, username } });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, display_name: displayName, username, role: "partner" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return Response.json({ error: "ثبت پروفایل کاربر ناموفق بود." }, { status: 500 });
  }
  return Response.json({ ok: true, user_id: data.user.id });
});