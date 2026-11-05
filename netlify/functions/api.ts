import serverless from "serverless-http";
import { createApp } from "../../server/_core/app";

// Modern (v2) Netlify Function: unlike Lambda-compatibility handlers it gets
// Netlify Database (NETLIFY_DB_URL) and Netlify Blobs configured automatically.
// The Express app is reused by translating the Request into the API Gateway
// event shape serverless-http understands, and the result back into a Response.
const app = serverless(createApp(), {
  binary: ["application/octet-stream", "application/pdf", "image/*"],
});

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  headers["x-forwarded-proto"] ??= url.protocol.replace(":", "");
  // Needed to build absolute URLs (e.g. the Google sign-in callback)
  headers["host"] ??= url.host;

  const multiValueQueryStringParameters: Record<string, string[]> = {};
  url.searchParams.forEach((value, key) => {
    (multiValueQueryStringParameters[key] ??= []).push(value);
  });

  const body = req.method === "GET" || req.method === "HEAD" ? null : Buffer.from(await req.arrayBuffer());
  const result: any = await app(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers,
      multiValueHeaders: {},
      queryStringParameters: Object.fromEntries(url.searchParams),
      multiValueQueryStringParameters,
      body: body && body.length ? body.toString("base64") : null,
      isBase64Encoded: true,
      requestContext: { identity: { sourceIp: headers["x-nf-client-connection-ip"] ?? "" } },
    },
    {}
  );

  const out = new Headers();
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (value !== undefined) out.set(key, String(value));
  }
  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
    out.delete(key);
    for (const value of values as unknown[]) out.append(key, String(value));
  }

  const responseBody = result.body
    ? result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body
    : null;
  return new Response(responseBody, { status: result.statusCode, headers: out });
};

export const config = { path: "/api/*" };
