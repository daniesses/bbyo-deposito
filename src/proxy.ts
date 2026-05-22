import type { NextRequest } from "next/server";

function unauthorizedResponse() {
  return new Response("Autenticacion requerida", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BBYO Deposito"',
    },
  });
}

function parseUsers(rawUsers: string) {
  return rawUsers
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex === -1) {
        return null;
      }

      return {
        user: entry.slice(0, separatorIndex).trim().toLowerCase(),
        password: entry.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((entry): entry is { user: string; password: string } =>
      Boolean(entry?.user && entry.password),
    );
}

export function proxy(request: NextRequest) {
  const authUsers = parseUsers(process.env.BASIC_AUTH_USERS ?? "");

  if (authUsers.length === 0) {
    return;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  try {
    const encodedCredentials = authHeader.split(" ")[1];
    const decodedCredentials = atob(encodedCredentials);
    const separatorIndex = decodedCredentials.indexOf(":");

    if (separatorIndex === -1) {
      return unauthorizedResponse();
    }

    const user = decodedCredentials.slice(0, separatorIndex).toLowerCase();
    const password = decodedCredentials.slice(separatorIndex + 1);

    const isAllowed = authUsers.some(
      (authUser) => authUser.user === user && authUser.password === password,
    );

    if (isAllowed) {
      return;
    }

    return unauthorizedResponse();
  } catch {
    return unauthorizedResponse();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
