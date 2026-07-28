const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const PROJECT_URL = process.env.TN_SUPABASE_URL;
const ANON_KEY = process.env.TN_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.TN_SUPABASE_SERVICE_ROLE_KEY;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("invalid_base32");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, offset = 0) {
  const counter = Math.floor(Date.now() / 30000) + offset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();
  const index = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[index] & 0x7f) << 24) |
    ((digest[index + 1] & 0xff) << 16) |
    ((digest[index + 2] & 0xff) << 8) |
    (digest[index + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function invoke(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (!error) return { status: 200, body: data };

  const response = error.context;
  let payload = null;
  if (response && typeof response.clone === "function") {
    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }
  }
  return {
    status: response?.status || 0,
    body: payload || { error: error.message },
  };
}

async function enrollTotp(client, friendlyName) {
  const enrollment = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (enrollment.error) throw enrollment.error;

  let lastError = null;
  for (const offset of [0, -1, 1]) {
    const verified = await client.auth.mfa.challengeAndVerify({
      factorId: enrollment.data.id,
      code: totp(enrollment.data.totp.secret, offset),
    });
    if (!verified.error) return;
    lastError = verified.error;
  }
  throw lastError || new Error("mfa_verify_failed");
}

async function subscribeToInvalidations(client) {
  const session = (await client.auth.getSession()).data.session;
  assert(session?.access_token, "realtime_session_missing");
  await client.realtime.setAuth(session.access_token);

  let resolveEvent;
  const event = new Promise((resolve) => {
    resolveEvent = resolve;
  });
  const channel = client
    .channel("client:announcements", {
      config: { private: true, broadcast: { ack: true } },
    })
    .on("broadcast", { event: "announcement_changed" }, resolveEvent);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("realtime_subscribe_timeout")),
      10_000,
    );
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(error || new Error("realtime_channel_error"));
      }
    });
  });
  return { channel, event };
}

async function cleanStaleIntegrationState(service) {
  const staleUsers = [];
  for (let page = 1; ; page += 1) {
    const listed = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) throw listed.error;
    staleUsers.push(
      ...listed.data.users.filter((entry) =>
        /^(announcement-admin|announcement-user)-/.test(entry.email || "")
      ),
    );
    if (listed.data.users.length < 1000) break;
  }

  for (const staleUser of staleUsers) {
    await service
      .from("client_announcements")
      .delete()
      .eq("created_by", staleUser.id);
    await service
      .from("client_announcement_rate_limits")
      .delete()
      .like("bucket", `%${staleUser.id}%`);
    await service.auth.admin.deleteUser(staleUser.id);
  }

  if (staleUsers.length > 0) {
    console.log(`CLEANUP removed ${staleUsers.length} stale integration users`);
  }
}

async function main() {
  if (!PROJECT_URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      "Set TN_SUPABASE_URL, TN_SUPABASE_ANON_KEY, and TN_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const run = Date.now().toString(36);
  const password = `Stage-${crypto.randomBytes(18).toString("base64url")}!7a`;
  const adminEmail = `announcement-admin-${run}@example.com`;
  const userEmail = `announcement-user-${run}@example.com`;
  const service = createClient(PROJECT_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await cleanStaleIntegrationState(service);

  let adminId = null;
  let userId = null;
  let announcementId = null;
  let channel = null;
  let admin = null;
  let user = null;

  try {
    const adminCreated = await service.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    if (adminCreated.error) throw adminCreated.error;
    adminId = adminCreated.data.user.id;

    const userCreated = await service.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
    });
    if (userCreated.error) throw userCreated.error;
    userId = userCreated.data.user.id;

    const promoted = await service.from("profiles").update({
      subscription_tier: "admin",
      access_tier: "admin",
      access_status: "active",
      terminal_access: true,
    }).eq("id", adminId);
    if (promoted.error) throw promoted.error;

    const authOptions = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    admin = createClient(PROJECT_URL, ANON_KEY, authOptions);
    user = createClient(PROJECT_URL, ANON_KEY, authOptions);
    const adminLogin = await admin.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    if (adminLogin.error) throw adminLogin.error;
    const userLogin = await user.auth.signInWithPassword({
      email: userEmail,
      password,
    });
    if (userLogin.error) throw userLogin.error;

    const directRead = await user
      .from("client_announcements")
      .select("id")
      .limit(1);
    assert(directRead.error, "direct_table_read_was_not_denied");
    const directWrite = await user.from("client_announcements").insert({
      title: "x",
      body: "x",
      created_by: userId,
    });
    assert(directWrite.error, "direct_table_write_was_not_denied");
    const directMutation = await user.rpc("mutate_client_announcement", {
      p_action: "create_draft",
      p_request_id: crypto.randomUUID(),
      p_payload: {},
    });
    assert(directMutation.error, "direct_privileged_rpc_was_not_denied");
    console.log("PASS direct table read/write denied");
    console.log("PASS direct privileged RPC denied");

    const aal1Admin = await invoke(admin, "admin-announcements", {
      action: "list",
    });
    assert(
      aal1Admin.status === 403 && aal1Admin.body?.error === "mfa_required",
      `expected_mfa_required_got_${aal1Admin.status}_${aal1Admin.body?.error}`,
    );
    console.log("PASS AAL1 admin denied");

    await enrollTotp(admin, "Integration Admin");
    const aal = await admin.auth.mfa.getAuthenticatorAssuranceLevel();
    assert(aal.data?.currentLevel === "aal2", "admin_not_promoted_to_aal2");
    const adminList = await invoke(admin, "admin-announcements", {
      action: "list",
    });
    assert(
      adminList.status === 200,
      `aal2_admin_list_failed_${adminList.status}_${adminList.body?.error}`,
    );
    console.log("PASS AAL2 admin accepted");

    const adminSession = (await admin.auth.getSession()).data.session;
    const hostileOrigin = await fetch(
      `${PROJECT_URL}/functions/v1/admin-announcements`,
      {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          authorization: `Bearer ${adminSession.access_token}`,
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ action: "list" }),
      },
    );
    const hostileOriginBody = await hostileOrigin.json();
    assert(
      hostileOrigin.status === 403 &&
        hostileOriginBody?.error === "origin_denied",
      `hostile_origin_was_not_denied_${hostileOrigin.status}_${hostileOriginBody?.error}`,
    );
    console.log("PASS hostile browser origin denied");

    await enrollTotp(user, "Integration User");
    const nonAdmin = await invoke(user, "admin-announcements", {
      action: "list",
    });
    assert(
      nonAdmin.status === 403 && nonAdmin.body?.error === "admin_required",
      `expected_admin_required_got_${nonAdmin.status}_${nonAdmin.body?.error}`,
    );
    console.log("PASS AAL2 non-admin denied");

    const payload = {
      severity: "info",
      title: `Integration notice ${run}`,
      body: "Disposable staging announcement for security verification.",
      starts_at: new Date(Date.now() - 1000).toISOString(),
      ends_at: null,
      platforms: ["all"],
      channels: ["beta"],
      min_version: "0.2.0-beta.1",
      max_version: "0.2.0",
      access_tiers: [],
      service_scopes: ["terminal"],
      dismissible: true,
      requires_ack: false,
      action_label: "Read docs",
      action_url: "https://www.tradenet.org/docs",
    };
    const createRequestId = crypto.randomUUID();
    const createRequest = {
      action: "create_draft",
      request_id: createRequestId,
      payload,
    };
    const created = await invoke(admin, "admin-announcements", createRequest);
    assert(
      created.status === 200,
      `create_failed_${created.status}_${created.body?.error}_${created.body?.field || "unknown"}_${created.body?.reason || "unknown"}`,
    );
    let announcement = created.body.announcement;
    announcementId = announcement.id;
    assert(
      announcement.status === "draft" && announcement.revision === 1,
      "draft_state_invalid",
    );
    console.log("PASS draft created");

    const replayedCreate = await invoke(
      admin,
      "admin-announcements",
      createRequest,
    );
    assert(
      replayedCreate.status === 200 &&
        replayedCreate.body?.idempotent === true &&
        replayedCreate.body?.announcement?.id === announcement.id,
      "idempotent_create_replay_failed",
    );
    console.log("PASS mutation request id is idempotent");

    const unconfirmed = await invoke(admin, "admin-announcements", {
      action: "publish",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision,
    });
    assert(
      unconfirmed.status === 400 &&
        unconfirmed.body?.error === "confirmation_required",
      "unconfirmed_publish_not_denied",
    );
    console.log("PASS unconfirmed publish denied");

    const published = await invoke(admin, "admin-announcements", {
      action: "publish",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision,
      confirmed: true,
    });
    assert(
      published.status === 200 &&
        published.body.announcement.status === "published",
      `publish_failed_${published.status}_${published.body?.error}`,
    );
    announcement = published.body.announcement;
    console.log("PASS announcement published");

    const snapshot = await invoke(user, "client-announcement-snapshot", {
      platform: "desktop",
      os: "windows",
      channel: "beta",
      version: "0.2.0-beta.12",
    });
    assert(
      snapshot.status === 200,
      `snapshot_failed_${snapshot.status}_${snapshot.body?.error}`,
    );
    assert(
      snapshot.body.announcements.some((item) => item.id === announcement.id),
      "published_announcement_missing_from_snapshot",
    );
    assert(
      !JSON.stringify(snapshot.body).includes("created_by"),
      "snapshot_leaked_admin_fields",
    );
    console.log("PASS authoritative snapshot filtered and sanitized");

    const versionExcluded = await invoke(user, "client-announcement-snapshot", {
      platform: "desktop",
      os: "windows",
      channel: "beta",
      version: "0.1.0",
    });
    assert(
      versionExcluded.status === 200 &&
        !versionExcluded.body.announcements.some(
          (item) => item.id === announcement.id,
        ),
      "version_targeting_did_not_exclude_old_client",
    );
    console.log("PASS semantic version targeting enforced");

    const realtime = await subscribeToInvalidations(user);
    channel = realtime.channel;
    const livePayload = {
      ...payload,
      body: "Revised staging announcement for private Broadcast verification.",
    };
    const missingText = await invoke(admin, "admin-announcements", {
      action: "update",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision,
      payload: livePayload,
      confirmed: true,
    });
    assert(
      missingText.status === 400 &&
        missingText.body?.error === "publish_confirmation_required",
      "live_update_without_typed_confirmation_not_denied",
    );

    const revised = await invoke(admin, "admin-announcements", {
      action: "update",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision,
      payload: livePayload,
      confirmed: true,
      confirmation_text: "PUBLISH",
    });
    assert(
      revised.status === 200 &&
        revised.body.announcement.revision === announcement.revision + 1,
      `live_update_failed_${revised.status}_${revised.body?.error}`,
    );
    announcement = revised.body.announcement;
    const realtimeEvent = await Promise.race([
      realtime.event,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("realtime_event_timeout")), 10_000)
      ),
    ]);
    assert(
      realtimeEvent.payload?.announcement_id === announcement.id,
      "realtime_payload_wrong_announcement",
    );
    assert(
      !("body" in realtimeEvent.payload),
      "realtime_payload_leaked_content",
    );
    console.log("PASS private Broadcast invalidation received");

    const stale = await invoke(admin, "admin-announcements", {
      action: "archive",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision - 1,
      confirmed: true,
    });
    assert(
      stale.status === 409 && stale.body?.error === "revision_conflict",
      "stale_revision_not_denied",
    );
    console.log("PASS stale revision denied");

    const archived = await invoke(admin, "admin-announcements", {
      action: "archive",
      request_id: crypto.randomUUID(),
      announcement_id: announcement.id,
      expected_revision: announcement.revision,
      confirmed: true,
    });
    assert(
      archived.status === 200 &&
        archived.body.announcement.status === "archived",
      `archive_failed_${archived.status}_${archived.body?.error}`,
    );
    const afterArchive = await invoke(user, "client-announcement-snapshot", {
      platform: "desktop",
      os: "windows",
      channel: "beta",
      version: "0.2.0-beta.12",
    });
    assert(
      !afterArchive.body.announcements.some(
        (item) => item.id === announcement.id,
      ),
      "archived_announcement_still_active",
    );
    const audit = await invoke(admin, "admin-announcements", {
      action: "audit",
      announcement_id: announcement.id,
    });
    assert(
      audit.status === 200 && audit.body.audit.length >= 4,
      "audit_history_incomplete",
    );
    console.log("PASS archive, snapshot removal, and audit history");

    const forbiddenSend = await channel.send({
      type: "broadcast",
      event: "announcement_changed",
      payload: { forged: true },
    });
    assert(
      forbiddenSend !== "ok",
      "authenticated_client_was_allowed_to_broadcast",
    );
    console.log("PASS client Broadcast send denied");
    console.log("INTEGRATION RESULT: PASS");
  } finally {
    if (channel) {
      try {
        await channel.unsubscribe();
      } catch {
        // Best-effort staging cleanup.
      }
    }
    for (const client of [admin, user]) {
      if (!client) continue;
      try {
        await client.removeAllChannels();
        await client.auth.signOut({ scope: "local" });
      } catch {
        // Best-effort staging cleanup.
      }
    }
    if (announcementId) {
      await service
        .from("client_announcements")
        .delete()
        .eq("id", announcementId);
    }
    if (adminId) {
      await service
        .from("client_announcement_rate_limits")
        .delete()
        .like("bucket", `%${adminId}%`);
      await service.auth.admin.deleteUser(adminId);
    }
    if (userId) {
      await service
        .from("client_announcement_rate_limits")
        .delete()
        .like("bucket", `%${userId}%`);
      await service.auth.admin.deleteUser(userId);
    }
    await service.removeAllChannels();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`INTEGRATION RESULT: FAIL (${error.message})`);
    process.exit(1);
  });
