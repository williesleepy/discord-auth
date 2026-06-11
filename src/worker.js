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

    if (url.pathname === "/login") {
      const redirect =
        "https://discord.com/api/oauth2/authorize" +
        `?client_id=${env.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(env.REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify guilds`;

      return Response.redirect(redirect, 302);
    }

    if (url.pathname === "/pcloud/login") {
      const redirect =
        "https://my.pcloud.com/oauth2/authorize" +
        `?client_id=${env.PCLOUD_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(env.PCLOUD_REDIRECT_URI)}`;

      return Response.redirect(redirect, 302);
    }

    if (url.pathname === "/pcloud/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Missing pCloud code", { status: 400 });
      }

      const tokenRes = await fetch("https://api.pcloud.com/oauth2_token", {
        body: new URLSearchParams({
          client_secret: env.PCLOUD_CLIENT_SECRET,
          client_id: env.PCLOUD_CLIENT_ID,
          code,
        }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });

      const tokenData = await tokenRes.json();

      return new Response(JSON.stringify(tokenData, null, 2), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
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

      const res = await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages?limit=20`,
        {
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          },
        },
      );

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/pcloud/list") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      const folder = url.searchParams.get("folder") || "/";

      const res = await fetch(
        `https://api.pcloud.com/listfolder?path=${encodeURIComponent(
          folder,
        )}&access_token=${env.PCLOUD_ACCESS_TOKEN}`,
      );

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/pcloud/file") {
      const auth = req.headers.get("Authorization");
      const token = auth?.replace("Bearer ", "");

      const user = await getUser(token);

      if (!user) {
        return new Response("Unauthorized", {
          headers: corsHeaders,
          status: 401,
        });
      }

      const path = url.searchParams.get("path");

      if (!path) {
        return new Response("Missing path", {
          headers: corsHeaders,
          status: 400,
        });
      }

      const attempts = [];
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const linkRes = await fetch(
          `https://api.pcloud.com/getfilelink?path=${encodeURIComponent(
            path,
          )}&access_token=${env.PCLOUD_ACCESS_TOKEN}`,
        );

        const linkData = await linkRes.json();

        if (linkData.result !== 0 || !linkData.hosts?.length) {
          attempts.push({
            stage: "getfilelink",
            linkData,
            attempt,
          });

          continue;
        }

        for (const host of linkData.hosts) {
          const fileUrl = `https://${host}${linkData.path}`;

          const fileRes = await fetch(fileUrl, {
            headers: {
              Referer: "https://my.pcloud.com/",
            },
          });

          if (fileRes.ok) {
            return new Response(fileRes.body, {
              headers: {
                ...corsHeaders,
                "Content-Type":
                  fileRes.headers.get("Content-Type") ||
                  "application/octet-stream",
                "Cache-Control": "private, max-age=300",
              },
              status: fileRes.status,
            });
          }

          attempts.push({
            contentType: fileRes.headers.get("Content-Type"),
            body: await fileRes.text(),
            status: fileRes.status,
            stage: "download",
            attempt,
            host,
          });
        }
      }

      return new Response(
        JSON.stringify(
          {
            error: "All pCloud file download attempts failed",
            requestedPath: path,
            attempts,
          },
          null,
          2,
        ),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 502,
        },
      );
    }

    return new Response("Not found", {
      headers: corsHeaders,
      status: 404,
    });
  },
};
