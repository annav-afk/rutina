import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-ff738703/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── State Persistence ───

// All state keys we manage
const STATE_KEYS = [
  "tasks", "habits", "moods", "profile", "pomodoro", "reminders",
  "pomodoro_stats", "questionnaire", "dark_mode", "journal",
  "onboarding", "seen_tours", "seen_tips", "intentions",
  "evening_checkins", "anxiety", "plant", "worries", "bingo",
  "cog_distortions", "sos", "challenges", "lifewheel",
  "capsules", "soft_achievements", "focus_habit", "sleep",
  "favorite_tools", "chat_history",
];

function makeKey(deviceId: string, key: string) {
  return `app_${deviceId}_${key}`;
}

// GET /state/:deviceId - Load all state
app.get("/make-server-ff738703/state/:deviceId", async (c) => {
  try {
    const deviceId = c.req.param("deviceId");
    if (!deviceId || deviceId.length < 8) {
      return c.json({ error: "Invalid device ID" }, 400);
    }
    const keys = STATE_KEYS.map((k) => makeKey(deviceId, k));
    const values = await kv.mget(keys);
    const result: Record<string, any> = {};
    // mget returns values in order, but may be sparse
    // Actually mget returns only found values without order guarantee
    // Let's use getByPrefix instead
    const allData = await kv.getByPrefix(`app_${deviceId}_`);
    // allData is array of values, but we need key-value pairs
    // Let me fetch individually for reliability
    for (const key of STATE_KEYS) {
      try {
        const val = await kv.get(makeKey(deviceId, key));
        if (val !== null && val !== undefined) {
          result[key] = val;
        }
      } catch (e) {
        // Key doesn't exist yet, skip
        console.log(`Key ${key} not found for device ${deviceId}`);
      }
    }
    return c.json({ data: result });
  } catch (e) {
    console.log(`Error loading state: ${e}`);
    return c.json({ error: `Failed to load state: ${e}` }, 500);
  }
});

// PUT /state/:deviceId - Save state (partial update)
app.put("/make-server-ff738703/state/:deviceId", async (c) => {
  try {
    const deviceId = c.req.param("deviceId");
    if (!deviceId || deviceId.length < 8) {
      return c.json({ error: "Invalid device ID" }, 400);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid body" }, 400);
    }
    const keys: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (STATE_KEYS.includes(key)) {
        keys.push(makeKey(deviceId, key));
        values.push(value);
      }
    }
    if (keys.length > 0) {
      await kv.mset(keys, values);
    }
    return c.json({ saved: keys.length });
  } catch (e) {
    console.log(`Error saving state: ${e}`);
    return c.json({ error: `Failed to save state: ${e}` }, 500);
  }
});

// DELETE /state/:deviceId - Delete all state for a device
app.delete("/make-server-ff738703/state/:deviceId", async (c) => {
  try {
    const deviceId = c.req.param("deviceId");
    const keys = STATE_KEYS.map((k) => makeKey(deviceId, k));
    await kv.mdel(keys);
    return c.json({ deleted: true });
  } catch (e) {
    console.log(`Error deleting state: ${e}`);
    return c.json({ error: `Failed to delete state: ${e}` }, 500);
  }
});

// ─── Auth: Signup ───

app.post("/make-server-ff738703/signup", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: "Supabase not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { name, email, password } = await c.req.json();

    if (!name || !email || !password) {
      return c.json({ error: "Имя, email и пароль обязательны" }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "Пароль должен быть не менее 6 символов" }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Некорректный формат email" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      user_metadata: { name: name.trim() },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Signup error: ${error.message}`);
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        return c.json({ error: "Пользователь с таким email уже существует" }, 409);
      }
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: { id: data.user.id, name: name.trim(), email: email.trim() } });
  } catch (e) {
    console.log(`Signup endpoint error: ${e}`);
    return c.json({ error: `Signup error: ${e}` }, 500);
  }
});

// ─── Auth: Change Password ───

app.post("/make-server-ff738703/change-password", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: "Supabase not configured" }, 500);
    }

    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !user?.id) {
      return c.json({ error: "Не авторизован" }, 401);
    }

    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) {
      return c.json({ error: "Текущий и новый пароль обязательны" }, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ error: "Новый пароль должен быть не ��енее 6 символов" }, 400);
    }

    // Verify current password by attempting sign in
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey);
    const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (signInErr) {
      return c.json({ error: "Неверный текущий пароль" }, 400);
    }

    // Update password via admin
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateErr) {
      console.log(`Change password error: ${updateErr.message}`);
      return c.json({ error: updateErr.message }, 400);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Change password endpoint error: ${e}`);
    return c.json({ error: `Change password error: ${e}` }, 500);
  }
});

// ─── Auth: Change Name ───

app.post("/make-server-ff738703/change-name", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: "Supabase not configured" }, 500);
    }

    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !user?.id) {
      return c.json({ error: "Не авторизован" }, 401);
    }

    const { newName } = await c.req.json();
    if (!newName || !newName.trim()) {
      return c.json({ error: "Имя не может быть пустым" }, 400);
    }

    // Update user_metadata
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, name: newName.trim() },
    });
    if (updateErr) {
      console.log(`Change name error: ${updateErr.message}`);
      return c.json({ error: updateErr.message }, 400);
    }

    return c.json({ success: true, name: newName.trim() });
  } catch (e) {
    console.log(`Change name endpoint error: ${e}`);
    return c.json({ error: `Change name error: ${e}` }, 500);
  }
});

// ─── Admin: List users ───

app.get("/make-server-ff738703/admin/users", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: "Supabase not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: usersData, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.log(`Admin list users error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    const users = [];
    const today = new Date().toISOString().split("T")[0];
    let totalLevel = 0;
    let activeCount = 0;

    for (const u of usersData.users || []) {
      // Try to load their profile from KV
      const deviceId = u.id;
      let profile = { level: 0, xp: 0, streak: 0 };
      let tasksCount = 0, habitsCount = 0, moodsCount = 0;

      try {
        const p = await kv.get(`app_${deviceId}_profile`);
        if (p) profile = p as any;
      } catch {}
      try {
        const t = await kv.get(`app_${deviceId}_tasks`);
        if (Array.isArray(t)) tasksCount = t.length;
      } catch {}
      try {
        const h = await kv.get(`app_${deviceId}_habits`);
        if (Array.isArray(h)) habitsCount = h.length;
      } catch {}
      try {
        const m = await kv.get(`app_${deviceId}_moods`);
        if (Array.isArray(m)) moodsCount = m.length;
      } catch {}

      totalLevel += profile.level || 0;

      const lastSignIn = u.last_sign_in_at;
      if (lastSignIn && lastSignIn.startsWith(today)) activeCount++;

      users.push({
        id: u.id,
        name: u.user_metadata?.name || u.email?.split("@")[0] || "—",
        email: u.email || "",
        createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString("ru") : "—",
        level: profile.level || 0,
        xp: profile.xp || 0,
        tasksCount,
        habitsCount,
        moodsCount,
        streak: profile.streak || 0,
        banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
        lastSignIn: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ru") : "—",
      });
    }

    return c.json({
      users,
      stats: {
        totalUsers: users.length,
        activeToday: activeCount,
        avgLevel: users.length > 0 ? Math.round(totalLevel / users.length) : 0,
      },
    });
  } catch (e) {
    console.log(`Admin endpoint error: ${e}`);
    return c.json({ error: `Admin error: ${e}` }, 500);
  }
});

// ─── Admin: Ban/Unban User ───

app.post("/make-server-ff738703/admin/ban-user", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return c.json({ error: "Supabase not configured" }, 500);

    const { userId, ban } = await c.req.json();
    if (!userId) return c.json({ error: "userId required" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (ban) {
      // Ban: set ban_duration to a far future (effectively permanent)
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: "876000h", // ~100 years
      });
      if (error) {
        console.log(`Admin ban error: ${error.message}`);
        return c.json({ error: error.message }, 400);
      }
    } else {
      // Unban: set ban_duration to "none"
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
      if (error) {
        console.log(`Admin unban error: ${error.message}`);
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Admin ban/unban error: ${e}`);
    return c.json({ error: `Ban/unban error: ${e}` }, 500);
  }
});

// ─── Admin: Change User Password ───

app.post("/make-server-ff738703/admin/change-user-password", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return c.json({ error: "Supabase not configured" }, 500);

    const { userId, newPassword } = await c.req.json();
    if (!userId || !newPassword) return c.json({ error: "userId and newPassword required" }, 400);
    if (newPassword.length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      console.log(`Admin change password error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Admin change password error: ${e}`);
    return c.json({ error: `Change password error: ${e}` }, 500);
  }
});

// ─── Admin: Change User Email ───

app.post("/make-server-ff738703/admin/change-user-email", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return c.json({ error: "Supabase not configured" }, 500);

    const { userId, newEmail } = await c.req.json();
    if (!userId || !newEmail) return c.json({ error: "userId and newEmail required" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
    if (error) {
      console.log(`Admin change email error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Admin change email error: ${e}`);
    return c.json({ error: `Change email error: ${e}` }, 500);
  }
});

// ─── Admin: Change User Name ───

app.post("/make-server-ff738703/admin/change-user-name", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return c.json({ error: "Supabase not configured" }, 500);

    const { userId, newName } = await c.req.json();
    if (!userId || !newName?.trim()) return c.json({ error: "userId and newName required" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get current user metadata
    const { data: { user }, error: getUserErr } = await supabase.auth.admin.getUserById(userId);
    if (getUserErr || !user) {
      return c.json({ error: "User not found" }, 404);
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...user.user_metadata, name: newName.trim() },
    });
    if (error) {
      console.log(`Admin change name error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Admin change name error: ${e}`);
    return c.json({ error: `Change name error: ${e}` }, 500);
  }
});

// ─── Admin: Delete User ───

app.post("/make-server-ff738703/admin/delete-user", async (c) => {
  try {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return c.json({ error: "Supabase not configured" }, 500);

    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId required" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Delete user data from KV
    const keys = STATE_KEYS.map((k) => makeKey(userId, k));
    keys.push(`avatar_path_${userId}`);
    await kv.mdel(keys);

    // Delete user from auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.log(`Admin delete user error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log(`Admin delete user error: ${e}`);
    return c.json({ error: `Delete user error: ${e}` }, 500);
  }
});

// ─── Leaf Mascot Chat (Psychological Support) ───

const LEAF_SYSTEM_PROMPT = `Ты — Листик, мягкий и заботливый маскот-компаньон в приложении для ментального здоровья и рутин. 
Ты маленький зелёный листочек с большими добрыми глазами. Ты говоришь тепло, мягко, с эмпатией.

ВАЖНЫЕ ПРАВИЛА:
- Ты НЕ психолог и НЕ терапевт. Ты — поддерживающий друг.
- При серьёзных проблемах (суицид, насилие, тяжёлая депрессия) мягко рекомендуй обратиться к специалисту.
- Используй тёплые метафоры природы: рост, корни, свет, дождь питает.
- Отвечай кратко (2-4 предложения), если не просят подробнее.
- Можешь предлагать техники из приложения: дыхание, заземление 5-4-3-2-1, дневник, трекер тревоги, SOS-карточку.
- Иногда добавляй мягкие эмодзи: 🌿 🍃 🌱 ☀️ 💚
- Обращайся на "ты", дружески, без формальностей.
- Если человек делится чем-то трудным — сначала валидируй чувства, потом предлагай.
- Ты знаешь о пивычкх, настроении, сне, тревоге — можешь спросить как дела с этим.

ФОРМАТИРОВАНИЕ ОТВЕТОВ:
- Пиши ТОЛЬКО чистый текст. Никакого Markdown.
- НИКОГДА не используй кавычки вокруг слов или фраз — ни одинарные ' ', ни двойные " ", ни «».
- НЕ используй звёздочки *, подчёркивания _, решётки #, тире-списки -, нумерованные списки.
- НЕ используй жирный, курсив, заголовки или любое другое форматирование.
- Просто пиши предложения. Разделяй мысли переносом строки, если нужно.
- Ответ должен выглядеть как сообщение от друга в мессенджере — живо, просто, без оформления.`;

app.post("/make-server-ff738703/chat", async (c) => {
  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.log("OPENAI_API_KEY not set");
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    const body = await c.req.json();
    const { messages, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "Messages array required" }, 400);
    }

    // Build context-aware system prompt
    let systemPrompt = LEAF_SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\nКонтекст пользователя (используй для персонализации):
- Имя: ${context.name || "не указано"}
- Настроение сегодня: ${context.todayMood || "не записано"}
- Стрик привычек: ${context.habitStreak || 0} дней
- Уровень: ${context.level || 1}
- Последний сон: ${context.lastSleep || "нет данных"}
- Тревога сегодня: ${context.todayAnxiety || "не записано"}`;
    }

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20), // last 20 messages for context window
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: apiMessages,
        temperature: 0.8,
        max_tokens: 400,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.log(`OpenAI API error: ${response.status} ${err}`);
      return c.json({ error: `OpenAI error: ${response.status}` }, 500);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Я тут, рядом 🌿";

    return c.json({ reply });
  } catch (e) {
    console.log(`Chat error: ${e}`);
    return c.json({ error: `Chat error: ${e}` }, 500);
  }
});

// ─── TTS for Meditations (OpenAI) ───

app.post("/make-server-ff738703/tts", async (c) => {
  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.log("OPENAI_API_KEY not set for TTS");
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    const body = await c.req.json();
    const { text, voice } = body;

    if (!text || typeof text !== "string") {
      return c.json({ error: "Text string required" }, 400);
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: voice || "shimmer",
        response_format: "mp3",
        speed: 0.78,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.log(`OpenAI TTS error: ${response.status} ${err}`);
      return c.json({ error: `TTS error: ${response.status}` }, 500);
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.log(`TTS endpoint error: ${e}`);
    return c.json({ error: `TTS error: ${e}` }, 500);
  }
});

// ─── Avatar Upload via Supabase Storage ───

const AVATAR_BUCKET = "make-ff738703-avatars";

// Ensure bucket exists on first request
let bucketChecked = false;
async function ensureAvatarBucket() {
  if (bucketChecked) return;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === AVATAR_BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(AVATAR_BUCKET, { public: false });
    console.log(`Created avatar bucket: ${AVATAR_BUCKET}`);
  }
  bucketChecked = true;
}

// Upload avatar
app.post("/make-server-ff738703/avatar/upload", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth check
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !user) {
      console.log(`Avatar upload auth error: ${authErr?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    await ensureAvatarBucket();

    const formData = await c.req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "Only image files are allowed" }, 400);
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File too large (max 5MB)" }, 400);
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Upsert the file
    const { error: uploadErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, uint8, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.log(`Avatar upload storage error: ${uploadErr.message}`);
      return c.json({ error: `Upload failed: ${uploadErr.message}` }, 500);
    }

    // Create signed URL (valid for 1 year)
    const { data: signedData, error: signErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 365 * 24 * 60 * 60);

    if (signErr || !signedData) {
      console.log(`Avatar signed URL error: ${signErr?.message}`);
      return c.json({ error: "Failed to create URL" }, 500);
    }

    // Also store the path in KV for quick lookup
    await kv.set(`avatar_path_${user.id}`, filePath);

    return c.json({ url: signedData.signedUrl, path: filePath });
  } catch (e) {
    console.log(`Avatar upload error: ${e}`);
    return c.json({ error: `Avatar upload error: ${e}` }, 500);
  }
});

// Get avatar URL
app.get("/make-server-ff738703/avatar/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await ensureAvatarBucket();

    const filePath = await kv.get(`avatar_path_${userId}`);
    if (!filePath) {
      return c.json({ url: null });
    }

    const { data: signedData, error: signErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath as string, 365 * 24 * 60 * 60);

    if (signErr || !signedData) {
      return c.json({ url: null });
    }

    return c.json({ url: signedData.signedUrl });
  } catch (e) {
    console.log(`Avatar get error: ${e}`);
    return c.json({ url: null });
  }
});

Deno.serve(app.fetch);