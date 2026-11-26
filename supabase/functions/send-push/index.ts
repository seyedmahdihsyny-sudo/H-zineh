import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  return Uint8Array.from(atob(body), c => c.charCodeAt(0));
}

async function getGoogleAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
  ));
  const assertion = unsigned + "." + base64Url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("دریافت مجوز Firebase ناموفق بود: " + JSON.stringify(data));
  }
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!accessToken) return Response.json({ error: "ورود الزامی است." }, { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userResult, error: userError } = await userClient.auth.getUser(accessToken);
    const user = userResult?.user;
    if (userError || !user) return Response.json({ error: "نشست معتبر نیست." }, { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || !profile) throw new Error("پروفایل کاربر پیدا نشد.");

    const body = await req.json();
    let title = "";
    let message = "";
    if (body.type === "app_update") {
      if (profile.role !== "admin") return Response.json({ error: "فقط مدیر اجازه ارسال اعلان به‌روزرسانی دارد." }, { status: 403, headers: corsHeaders });
      const version = String(body.version || "").slice(0, 30);
      const notes = String(body.notes || "").slice(0, 180);
      title = "نسخه جدید H-zineh آماده است";
      message = notes ? "نسخه " + version + " - " + notes : "نسخه " + version + " برای دریافت آماده است.";
    } else if (body.type === "expense_created") {
      const expenseId = String(body.expense_id || "");
      const { data: expense, error: expenseError } = await admin
        .from("expenses").select("id,title,created_by").eq("id", expenseId).maybeSingle();
      if (expenseError || !expense || expense.created_by !== user.id) {
        return Response.json({ error: "هزینه ثبت‌شده برای این کاربر تأیید نشد." }, { status: 403, headers: corsHeaders });
      }
      title = "هزینه جدید ثبت شد";
      message = String(expense.title || "یک هزینه جدید").slice(0, 180);
    } else {
      return Response.json({ error: "نوع اعلان نامعتبر است." }, { status: 400, headers: corsHeaders });
    }

    const serviceAccountText = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountText) throw new Error("تنظیم امن Firebase هنوز انجام نشده است.");
    const serviceAccount = JSON.parse(serviceAccountText);
    const googleToken = await getGoogleAccessToken(serviceAccount);
    const { data: devices, error: devicesError } = await admin
      .from("push_tokens").select("token").neq("user_id", user.id);
    if (devicesError) throw devicesError;
    if (!devices?.length) return Response.json({ ok: true, sent: 0, message: "هنوز دستگاه دیگری ثبت نشده است." }, { headers: corsHeaders });

    let sent = 0;
    const invalidTokens: string[] = [];
    for (const device of devices) {
      const response = await fetch(
        "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(serviceAccount.project_id) + "/messages:send",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + googleToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title, body: message },
              android: { priority: "HIGH", notification: { channel_id: "general", sound: "default" } },
              data: { type: body.type },
            },
          }),
        },
      );
      const result = await response.json();
      if (response.ok) sent++;
      else if (result?.error?.details?.some((x: any) => x.errorCode === "UNREGISTERED") ||
               result?.error?.status === "NOT_FOUND") invalidTokens.push(device.token);
      else console.error("FCM send failed:", result);
    }
    if (invalidTokens.length) await admin.from("push_tokens").delete().in("token", invalidTokens);
    return Response.json({ ok: true, sent, removedInvalidTokens: invalidTokens.length }, { headers: corsHeaders });
  } catch (error) {
    console.error("send-push error:", error);
    return Response.json({ error: error?.message || "خطای داخلی ارسال اعلان" }, { status: 500, headers: corsHeaders });
  }
});
