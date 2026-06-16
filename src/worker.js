export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    const corsHeaders = {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Origin": env.FRONTEND_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    async function getUser(token) {
      if (!token) return null;

      const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return null;
      return res.json();
    }

    async function isInGuild(token) {
      const res = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return false;

      const guilds = await res.json();
      return guilds.some((g) => g.id === env.GUILD_ID);
    }

    function addDiscordUrls(messages, env) {
      return messages.map((msg) => ({
        ...msg,
        discord_url: `https://discord.com/channels/${env.GUILD_ID}/${env.DISCORD_CHANNEL_ID}/${msg.id}`,
      }));
    }

    if (url.pathname === "/login") {
      const redirect =
        "https://discord.com/api/oauth2/authorize" +
        `?client_id=${env.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(env.REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify guilds`;

      return Response.redirect(redirect, 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Missing code", { status: 400 });
      }

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        body: new URLSearchParams({
          client_secret: env.CLIENT_SECRET,
          grant_type: "authorization_code",
          redirect_uri: env.REDIRECT_URI,
          client_id: env.CLIENT_ID,
          code,
        }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });

      const { access_token } = await tokenRes.json();

      if (!access_token) {
        return new Response("Auth failed", { status: 401 });
      }

      const inServer = await isInGuild(access_token);

      if (!inServer) {
        return new Response("Not in server", { status: 403 });
      }

      const redirectTo = `${env.FRONTEND_ORIGIN}${env.APP_PATH}#token=${access_token}`;

      return Response.redirect(redirectTo, 302);
    }

    if (url.pathname === "/me") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      return new Response(JSON.stringify(user), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/send") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      const formData = await req.formData();
      const message = formData.get("message") || "";
      const file = formData.get("file");

      const discordForm = new FormData();

      discordForm.append(
        "payload_json",
        JSON.stringify({
          content: `**${user.username}**: ${message}`,
        }),
      );

      if (file && file.size > 0) {
        discordForm.append("files[0]", file, file.name);
      }

      await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`,
        {
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          },
          body: discordForm,
          method: "POST",
        },
      );

      return new Response("sent", { headers: corsHeaders });
    }

    if (url.pathname === "/messages") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
      const before = url.searchParams.get("before");

      const params = new URLSearchParams({
        limit: String(limit),
      });

      if (before) {
        params.set("before", before);
      }

      const res = await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages?${params.toString()}`,
        {
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          },
        },
      );

      const data = await res.json();
      const enriched = addDiscordUrls(data, env);

      return new Response(JSON.stringify(enriched), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/messages/all") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      const allMessages = [];
      let before = null;
      const limit = 100;

      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
        });

        if (before) {
          params.set("before", before);
        }

        const res = await fetch(
          `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages?${params.toString()}`,
          {
            headers: {
              Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            },
          },
        );

        if (!res.ok) {
          return new Response(await res.text(), {
            headers: corsHeaders,
            status: res.status,
          });
        }

        const batch = await res.json();

        if (!batch.length) break;

        allMessages.push(...batch);

        if (batch.length < limit) break;

        before = batch[batch.length - 1].id;
      }

      const enriched = addDiscordUrls(allMessages, env);

      return new Response(JSON.stringify(enriched), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not found", {
      headers: corsHeaders,
      status: 404,
    });
  },
};
