import { connectLambda } from "@netlify/blobs";
import serverless from "serverless-http";
import { createApp } from "../../server/_core/app";

const app = serverless(createApp(), {
  binary: ["application/octet-stream", "application/pdf", "image/*"],
});

// All /api/* requests are rewritten here by netlify.toml.
// connectLambda wires up Netlify Blobs credentials for Lambda-style handlers.
export const handler = async (event: any, context: any) => {
  if (event.blobs) connectLambda(event);
  return app(event, context);
};
