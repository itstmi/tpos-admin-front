function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

const cfTeamDomain = process.env.CF_TEAM_DOMAIN || '';
const cfAud = process.env.CF_AUD || '';

export const config = Object.freeze({
  port: Number(process.env.PORT || 3100),
  dbUrl: need('DB_URL').replace(/\/?$/, '/'),
  dbKeyFile: need('DB_KEY_FILE'),
  panelHost: need('PANEL_HOST').toLowerCase(),
  appHost: need('APP_HOST').toLowerCase(),
  appClientKey: need('APP_CLIENT_KEY'),
  superAdminEmail: need('SUPER_ADMIN_EMAIL').toLowerCase(),
  cfTeamDomain: cfTeamDomain.replace(/\/$/, ''),
  cfAud,
  panelReady: Boolean(cfTeamDomain && cfAud),
});
