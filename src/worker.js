/*

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": env.FRONTEND_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ------------------------
    // Helpers
    // ------------------------
    async function getUser(token) {
      if (!token) return null;

      const res = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return null;
      return res.json();
    }

    async function isInGuild(token) {
      const res = await fetch(
        "https://discord.com/api/users/@me/guilds",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return false;

      const guilds = await res.json();
      return guilds.some((g) => g.id === env.GUILD_ID);
    }

    // ------------------------
    // LOGIN
    // ------------------------
    if (url.pathname === "/login") {
      const redirect =
        "https://discord.com/api/oauth2/authorize" +
        `?client_id=${env.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(env.REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify guilds`;

      return Response.redirect(redirect, 302);
    }

    // ------------------------
    // CALLBACK (still checks guild)
    // ------------------------
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Missing code", { status: 400 });
      }

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: env.REDIRECT_URI,
        }),
      });

      const { access_token } = await tokenRes.json();

      if (!access_token) {
        return new Response("Auth failed", { status: 401 });
      }

      // ✅ ONLY place we check guild membership
      const inServer = await isInGuild(access_token);

      if (!inServer) {
        return new Response("Not in server", { status: 403 });
      }

      const redirectTo =
        `${env.FRONTEND_ORIGIN}${env.APP_PATH}#token=${access_token}`;

      return Response.redirect(redirectTo, 302);
    }

    // ------------------------
    // /me
    // ------------------------
    if (url.pathname === "/me") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify(user), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // ------------------------
    // SEND MESSAGE (simplified)
    // ------------------------
    if (url.pathname === "/send") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const { message } = await req.json();

      await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `**${user.username}**: ${message}`,
          }),
        }
      );

      return new Response("sent", { headers: corsHeaders });
    }

    // ------------------------
    // GET MESSAGES (simplified)
    // ------------------------
    if (url.pathname === "/messages") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      }

      const res = await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages?limit=20`,
        {
          headers: {
            "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders,
    });
  },
};

*/
