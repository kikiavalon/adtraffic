// Slice 3 closes public self-registration once an admin exists. The rest of the
// suite predates that and seeds multiple users through /register, so default
// tests to OPEN registration. register-closed.test.ts opts into the closed
// behavior by clearing this env var per-test.
process.env.ALLOW_OPEN_REGISTRATION = 'true';
