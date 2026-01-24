import { env } from 'node:process';

export default async function globalSetup() {
  if (env.HUMAN === '1') return; // The flag indicates that the test is run by a human, not by an automated test runner or LLM.
  if (env.PWDEBUG === '1') throw new Error('The --debug option is for user interactive mode. Not for automated test runs. If you need more verbose logging use useConsoleOutput hook instead.');
}
