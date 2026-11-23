export const port = Number(process.env.IDENTITY_PORT || 8841);
export const dbPort = Number(process.env.IDENTITY_DB_PORT || 54441);
export const origin = "http://127.0.0.1:" + port;
export const fixtureDatabase =
  "postgres://postgres:postgres@127.0.0.1:" + dbPort + "/identity_fixture";
